/**
 * A module-level hook the API client (api/client.ts) uses to fetch the
 * current Firebase ID token without importing React context. AuthProvider
 * registers the getter on mount; before that (or when signed out) requests
 * go out without a bearer token and the backend answers 401.
 */
let getter: (() => Promise<string | null>) | null = null;

export function registerTokenGetter(fn: (() => Promise<string | null>) | null): void {
  getter = fn;
}

export async function getAccessToken(): Promise<string | null> {
  return getter ? getter() : null;
}
