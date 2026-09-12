import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";
import { registerTokenGetter } from "./tokenProvider";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerId: string | null;
}

export type AuthStatus = "unconfigured" | "loading" | "signed-in" | "signed-out";

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Fresh Firebase ID token for the API's `Authorization: Bearer` header
   * (Firebase refreshes it itself; `getIdToken` returns a cached-but-valid
   * token unless forced). Null when signed out. */
  getIdToken: () => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/** LOCAL DEVELOPMENT ONLY: `VITE_AUTH_DEV_BYPASS=1` in a dev build presents
 * a fake signed-in operator so the console can be exercised before a
 * Firebase project exists (pair with the backend's AUTH_DEV_BYPASS_UID).
 * Ignored entirely in production builds. */
const DEV_BYPASS = import.meta.env.DEV && import.meta.env.VITE_AUTH_DEV_BYPASS === "1";
const DEV_USER: AuthUser = { uid: "dev-operator", email: "dev@local.dev", displayName: "Dev Operator", photoURL: null, providerId: "dev-bypass" };

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    providerId: user.providerData[0]?.providerId ?? null,
  };
}

/** Owns the Firebase session for the whole app. Mounted once in App.tsx
 * above the router so every route (and the API client via
 * `api/client.ts`'s token getter) sees the same session. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(DEV_BYPASS ? "signed-in" : isFirebaseConfigured ? "loading" : "unconfigured");
  const [user, setUser] = useState<AuthUser | null>(DEV_BYPASS ? DEV_USER : null);

  useEffect(() => {
    if (DEV_BYPASS || !isFirebaseConfigured) return;
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (next) => {
      setUser(next ? toAuthUser(next) : null);
      setStatus(next ? "signed-in" : "signed-out");
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(getFirebaseAuth(), provider);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, displayName?: string) => {
    const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    const name = displayName?.trim();
    if (name) {
      await updateProfile(credential.user, { displayName: name });
      setUser(toAuthUser(credential.user));
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
  }, []);

  const signOut = useCallback(async () => {
    if (DEV_BYPASS) {
      setUser(null);
      setStatus("signed-out");
      return;
    }
    await firebaseSignOut(getFirebaseAuth());
  }, []);

  const getIdToken = useCallback(async () => {
    if (DEV_BYPASS || !isFirebaseConfigured) return null;
    const current = getFirebaseAuth().currentUser;
    if (!current) return null;
    return current.getIdToken();
  }, []);

  useEffect(() => {
    registerTokenGetter(getIdToken);
    return () => registerTokenGetter(null);
  }, [getIdToken]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, signOut, getIdToken }),
    [status, user, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, signOut, getIdToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
