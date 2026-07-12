import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type SecureSecretResult = {
  value: string;
  setValue: (value: string) => void;
  ready: boolean;
  error: string | null;
};

export function useSecureSecret(legacyStorageKey: string): SecureSecretResult {
  const [value, setValueState] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let stored = await invoke<string | null>("get_openrouter_key");
        const legacy = window.localStorage.getItem(legacyStorageKey);
        if (!stored && legacy) {
          stored = legacy;
          await invoke("set_openrouter_key", { value: legacy });
        }
        window.localStorage.removeItem(legacyStorageKey);
        if (!cancelled) setValueState(stored ?? "");
      } catch (err) {
        if (!cancelled) setError(`secure storage unavailable - ${String(err)}`);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [legacyStorageKey]);

  const setValue = useCallback((next: string) => {
    setValueState(next);
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void invoke("set_openrouter_key", { value: next }).catch((err) => {
        setError(`could not update secure storage - ${String(err)}`);
      });
    }, 250);
  }, []);

  return { value, setValue, ready, error };
}
