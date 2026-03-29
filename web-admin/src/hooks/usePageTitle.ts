import { useEffect } from 'react';

/**
 * Sets the browser tab title to "{title} — SafeRide".
 * Resets to "SafeRide" on unmount.
 */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title.trim() !== '' ? `${title} — SafeRide` : 'SafeRide';
    return () => {
      document.title = 'SafeRide';
    };
  }, [title]);
}
