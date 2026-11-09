"use client";

import { google as cfg } from "@/lib/google";

/*
 * Krótkotrwałe tokeny Google w przeglądarce (Google Identity Services), bez zapisywania (D-08, D-21).
 * Każdy zestaw uprawnień ma własny token w pamięci karty, ważny ok. godziny.
 */

type TokenResponse = { access_token?: string; expires_in?: number; error?: string };
type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void };
type GisGlobal = {
  accounts: {
    oauth2: {
      initTokenClient: (o: {
        client_id: string;
        scope: string;
        callback: (r: TokenResponse) => void;
        error_callback?: (e: { type: string }) => void;
      }) => TokenClient;
    };
  };
};

const scripts = new Map<string, Promise<void>>();
export function loadScript(src: string) {
  if (!scripts.has(src)) {
    scripts.set(
      src,
      new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => {
          scripts.delete(src);
          reject(new Error(`Nie udało się wczytać ${src}`));
        };
        document.head.appendChild(s);
      }),
    );
  }
  return scripts.get(src)!;
}

const cache = new Map<string, { token: string; expires: number }>();

/**
 * Token z podanymi zakresami. `selectAccount` wymusza wybór konta Google (np. import z innego konta niż ostatnio).
 * Musi być wywołane bezpośrednio po kliknięciu — inaczej przeglądarka zablokuje okno Google.
 */
export async function getGoogleToken(scope: string, opts: { selectAccount?: boolean } = {}): Promise<string> {
  const hit = cache.get(scope);
  if (!opts.selectAccount && hit && hit.expires > Date.now() + 60_000) return hit.token;
  await loadScript("https://accounts.google.com/gsi/client");
  const g = (window as unknown as { google?: GisGlobal }).google;
  if (!g?.accounts) throw new Error("Usługa logowania Google nie odpowiada.");
  return new Promise((resolve, reject) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: cfg.clientId,
      scope,
      callback: (r) => {
        if (!r.access_token) return reject(new Error(r.error === "access_denied" ? "Nie udzielono dostępu." : "Google nie wydał dostępu."));
        cache.set(scope, { token: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000 });
        resolve(r.access_token);
      },
      error_callback: (e) =>
        reject(new Error(e.type === "popup_closed" ? "Zamknięto okno Google." : "Nie udało się otworzyć okna Google. Kliknij przycisk jeszcze raz.")),
    });
    client.requestAccessToken({ prompt: opts.selectAccount ? "select_account" : "" });
  });
}

export const forgetToken = (scope: string) => cache.delete(scope);
