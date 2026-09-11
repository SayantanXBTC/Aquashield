/**
 * Every Anime.js handle this app creates (a JSAnimation, a Timeline, a
 * ScrollObserver) must be reverted on unmount — otherwise its ticker keeps
 * running and its scroll/resize listeners keep firing against an unmounted
 * DOM node. Components store what they create and pass it here in a
 * `useEffect` cleanup; nothing else in the codebase should call `.revert()`
 * directly, so this stays the one place that knows how.
 */

type Revertible = { revert: () => unknown } | null | undefined;

export function cleanupAnimations(...instances: Revertible[]): void {
  for (const instance of instances) {
    instance?.revert();
  }
}
