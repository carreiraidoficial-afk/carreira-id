import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type CarreiraTheme = 'dark-orange' | 'light-orange';

const STORAGE_KEY = 'carreira_theme';
const EVENT_NAME = 'carreira-theme-change';

function isCarreiraTheme(value: string | null): value is CarreiraTheme {
  return value === 'dark-orange' || value === 'light-orange';
}

function readTheme(): CarreiraTheme {
  if (typeof window === 'undefined') return 'dark-orange';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isCarreiraTheme(stored) ? stored : 'dark-orange';
}

function applyThemeToRoot(theme: CarreiraTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) callback();
  });
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
  };
}

function getSnapshot(): CarreiraTheme {
  return readTheme();
}

function getServerSnapshot(): CarreiraTheme {
  return 'dark-orange';
}

export function useCarreiraTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Always keep <html data-theme> in sync so portals/dialogs inherit the theme too.
  useEffect(() => {
    applyThemeToRoot(theme);
  }, [theme]);

  const updateTheme = useCallback((nextTheme: CarreiraTheme) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    applyThemeToRoot(nextTheme);
    window.dispatchEvent(new Event(EVENT_NAME));
  }, []);

  const setDarkTheme = useCallback((isDark: boolean) => {
    updateTheme(isDark ? 'dark-orange' : 'light-orange');
  }, [updateTheme]);

  return {
    theme,
    isDarkTheme: theme === 'dark-orange',
    setTheme: updateTheme,
    setDarkTheme,
  };
}
