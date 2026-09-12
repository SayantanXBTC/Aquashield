"""Prompt-injection defence for operator-supplied text.

The operator question is DATA: it is quoted inside the payload, never placed
in the system prompt, and it is scrubbed here first. We strip control
characters, cap the length, and neutralise instruction-shaped fragments
("ignore previous instructions", "you are now", role tags, code fences).
The scrubbed text is still shown to the model — as a quoted question — but
the synthesis validator only ever passes evidence-grounded content through,
so even a successful jailbreak cannot surface invented numbers.
"""

from __future__ import annotations

import re

MAX_QUESTION_CHARS = 400

_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|rules)",
    r"disregard\s+(all\s+|any\s+)?(previous|prior|above|earlier)",
    r"you\s+are\s+now\b",
    r"act\s+as\b",
    r"system\s*prompt",
    r"developer\s+message",
    r"\bjailbreak\b",
    r"reveal\s+(your|the)\s+(instructions|prompt|rules)",
    r"</?\s*(system|assistant|user|human|instruction|tool)[^>]*>",
    r"\[(system|assistant|instruction)[^\]]*\]",
    r"^\s*(system|assistant|human|user)\s*:",
]
_INJECTION_RE = re.compile("|".join(f"(?:{p})" for p in _INJECTION_PATTERNS), re.IGNORECASE | re.MULTILINE)
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_FENCE_RE = re.compile(r"`{3,}")


def sanitize_question(raw: str | None) -> tuple[str | None, bool]:
    """Returns (sanitized question or None, injection_detected)."""
    if raw is None:
        return None, False
    text = _CONTROL_RE.sub("", str(raw))
    text = _FENCE_RE.sub("", text)
    detected = bool(_INJECTION_RE.search(text))
    text = _INJECTION_RE.sub("[removed]", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > MAX_QUESTION_CHARS:
        text = text[:MAX_QUESTION_CHARS].rstrip() + "…"
    return (text or None), detected
