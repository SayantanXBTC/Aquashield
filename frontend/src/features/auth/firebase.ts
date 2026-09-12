/**
 * Firebase app/auth bootstrap. Configuration comes only from Vite env
 * (`VITE_FIREBASE_*` in frontend/.env.local — see frontend/.env.example);
 * nothing is hard-coded. When the config is absent the app still boots:
 * `isFirebaseConfigured` is false, the sign-in card renders an explicit
 * configuration error, and no Firebase call is ever attempted.
 */
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);

export const MISSING_FIREBASE_CONFIG_MESSAGE =
  "Firebase is not configured. Copy frontend/.env.example to frontend/.env.local and fill in the VITE_FIREBASE_* values from your Firebase project's web app settings.";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (!isFirebaseConfigured) throw new Error(MISSING_FIREBASE_CONFIG_MESSAGE);
  if (!auth) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
    auth = getAuth(app);
  }
  return auth;
}
