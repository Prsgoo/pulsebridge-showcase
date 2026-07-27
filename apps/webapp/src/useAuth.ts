import { useState } from "react";

const STORAGE_KEY = "pb-api-key";

export function useAuth(): {
  apiKey: string | null;
  setApiKey: (key: string | null) => void;
} {
  const [apiKey, setApiKeyState] = useState<string | null>(() =>
    sessionStorage.getItem(STORAGE_KEY),
  );

  const setApiKey = (key: string | null) => {
    if (key) sessionStorage.setItem(STORAGE_KEY, key);
    else sessionStorage.removeItem(STORAGE_KEY);
    setApiKeyState(key);
  };

  return { apiKey, setApiKey };
}
