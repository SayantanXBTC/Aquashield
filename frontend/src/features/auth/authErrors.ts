/** Firebase Auth error codes -> plain operator-facing text. Anything not
 * listed falls through to Firebase's own message, never to a blank. */
const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "That email address is not valid.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/user-not-found": "No account exists for that email.",
  "auth/wrong-password": "Incorrect password.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/invalid-login-credentials": "Incorrect email or password.",
  "auth/email-already-in-use": "An account already exists for that email.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/popup-closed-by-user": "The Google sign-in window was closed before finishing.",
  "auth/popup-blocked": "The browser blocked the Google sign-in popup.",
  "auth/cancelled-popup-request": "Sign-in was cancelled.",
  "auth/network-request-failed": "Network error — check your connection.",
  "auth/operation-not-allowed": "This sign-in method is not enabled in the Firebase project.",
  "auth/unauthorized-domain": "This domain is not authorised in the Firebase project's Auth settings.",
  "auth/missing-password": "Enter a password.",
};

export function describeAuthError(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if (MESSAGES[code]) return MESSAGES[code];
    if ("message" in error) return String((error as { message: unknown }).message);
    return code;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
