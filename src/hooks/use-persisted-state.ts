import { useCallback, useEffect, useState } from "react";

type SetValue<T> = T | ((prev: T) => T);

export function usePersistedState<T>(
  key: string,
  initial: T,
): [T, (next: SetValue<T>) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw == null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota / serialization errors
    }
  }, [key, value]);

  // sync across windows/tabs sharing the same origin — `storage` events only
  // fire in *other* windows, so this keeps a second marknote window in lock-step
  // when the user toggles something (e.g. the secrets eye) in the first one.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || e.storageArea !== window.localStorage) return;
      if (e.newValue == null) {
        setValue(initial);
        return;
      }
      try {
        setValue(JSON.parse(e.newValue) as T);
      } catch {
        // ignore — malformed payload from another tab
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // `initial` is captured by the closure on purpose — changing it later
    // shouldn't reset the value mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // accepts both value and functional-updater forms (matches React's setState API)
  const update = useCallback((next: SetValue<T>) => setValue(next), []);
  return [value, update];
}
