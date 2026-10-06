import type { Href, useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/**
 * Leaves the current screen for good (after deleting it, or when it no longer exists): goes back
 * to wherever the user came from, or to `fallback` when there is no history, as after opening a
 * deep link. Avoids stacking a second copy of the tabs on top of the first.
 */
export function leaveScreen(router: Router, fallback: Href) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
