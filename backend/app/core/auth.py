"""Firebase ID-token verification and the `CurrentUser` dependency.

Every scenario/run route depends on `get_current_user`, which:
  1. reads `Authorization: Bearer <firebase-id-token>`,
  2. verifies the RS256 signature against Google's published x509 certs for
     `securetoken@system.gserviceaccount.com` (cached per the response's
     Cache-Control max-age, refreshed on an unknown `kid`),
  3. checks `aud == FIREBASE_PROJECT_ID`, `iss == https://securetoken.google.com/<project>`,
     `exp`, `iat`, and a non-empty `sub`.

Only the project id is needed — no service-account credentials, no
firebase-admin dependency (architecture.md ADR-007). Tokens are never
trusted on the client's say-so: `owner_uid` on every row comes from the
verified `sub` claim, never from a request body.
"""

from __future__ import annotations

import re
import threading
import time
from dataclasses import dataclass
from typing import Annotated, Any

import httpx
import jwt
from cryptography.x509 import load_pem_x509_certificate
from fastapi import Depends, HTTPException, Request
from jwt import PyJWTError

from app.config.settings import settings

GOOGLE_CERTS_URL = (
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
)
_CERT_REFRESH_FLOOR_SECONDS = 60
_MAX_AGE_RE = re.compile(r"max-age=(\d+)")


@dataclass(frozen=True)
class AuthenticatedUser:
    uid: str
    email: str | None
    name: str | None
    picture: str | None
    sign_in_provider: str | None


class _CertCache:
    """Process-wide cache of Google's signing certs keyed by `kid`."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._certs: dict[str, str] = {}
        self._expires_at = 0.0

    def get(self, kid: str) -> str | None:
        with self._lock:
            if time.monotonic() >= self._expires_at or kid not in self._certs:
                self._refresh()
            return self._certs.get(kid)

    def _refresh(self) -> None:
        response = httpx.get(GOOGLE_CERTS_URL, timeout=10.0)
        response.raise_for_status()
        certs = response.json()
        if not isinstance(certs, dict):
            raise ValueError("unexpected Google cert payload")
        max_age = _CERT_REFRESH_FLOOR_SECONDS
        match = _MAX_AGE_RE.search(response.headers.get("cache-control", ""))
        if match:
            max_age = max(_CERT_REFRESH_FLOOR_SECONDS, int(match.group(1)))
        self._certs = {str(k): str(v) for k, v in certs.items()}
        self._expires_at = time.monotonic() + max_age


_cert_cache = _CertCache()


class FirebaseTokenVerifier:
    def __init__(self, project_id: str) -> None:
        self.project_id = project_id
        self.issuer = f"https://securetoken.google.com/{project_id}"

    def verify(self, token: str) -> AuthenticatedUser:
        try:
            header = jwt.get_unverified_header(token)
        except PyJWTError as exc:
            raise ValueError("malformed token") from exc
        if header.get("alg") != "RS256":
            raise ValueError("unexpected token algorithm")
        kid = header.get("kid")
        if not kid:
            raise ValueError("token has no key id")

        cert_pem = _cert_cache.get(str(kid))
        if cert_pem is None:
            raise ValueError("unknown signing key")
        key = load_pem_x509_certificate(cert_pem.encode()).public_key()

        try:
            claims: dict[str, Any] = jwt.decode(
                token,
                key=key,
                algorithms=["RS256"],
                audience=self.project_id,
                issuer=self.issuer,
                options={"require": ["exp", "iat", "sub", "aud", "iss"]},
                leeway=30,
            )
        except PyJWTError as exc:
            raise ValueError(f"invalid token: {exc}") from exc

        uid = str(claims.get("sub") or "").strip()
        if not uid:
            raise ValueError("token has no subject")
        firebase_claims = claims.get("firebase") or {}
        return AuthenticatedUser(
            uid=uid,
            email=claims.get("email"),
            name=claims.get("name"),
            picture=claims.get("picture"),
            sign_in_provider=firebase_claims.get("sign_in_provider")
            if isinstance(firebase_claims, dict)
            else None,
        )


_verifier: FirebaseTokenVerifier | None = None


def _get_verifier() -> FirebaseTokenVerifier:
    global _verifier
    if _verifier is None:
        if not settings.firebase_project_id:
            raise HTTPException(
                status_code=503,
                detail="Authentication is not configured: set FIREBASE_PROJECT_ID in backend/.env.",
            )
        _verifier = FirebaseTokenVerifier(settings.firebase_project_id)
    return _verifier


def get_current_user(request: Request) -> AuthenticatedUser:
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        if settings.auth_dev_bypass_uid:
            # Local-development escape hatch (settings.py) — see the warning
            # logged at startup in app/main.py.
            uid = settings.auth_dev_bypass_uid
            return AuthenticatedUser(uid=uid, email=f"{uid}@local.dev", name="Dev Operator", picture=None, sign_in_provider="dev-bypass")
        raise HTTPException(
            status_code=401,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    verifier = _get_verifier()
    try:
        return verifier.verify(token.strip())
    except (ValueError, httpx.HTTPError) as exc:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid or expired token ({exc})",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
