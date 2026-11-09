"use client";

import { DRIVE_SCOPE, google as cfg } from "@/lib/google";

/*
 * Dysk Google po stronie przeglądarki, bez przechowywania tokenów (D-08, D-05).
 * 1. Google Identity Services wydaje krótkotrwały token (ok. 1 h) z zakresem drive.file.
 * 2. Google Picker pokazuje pliki użytkownika; widzimy tylko to, co wskaże.
 * 3. Drive API tworzy dokument Google Docs z HTML scenariusza.
 * Token trzymamy wyłącznie w pamięci karty.
 */

type TokenResponse = { access_token?: string; expires_in?: number; error?: string };
type GoogleGlobal = {
  accounts: {
    oauth2: {
      initTokenClient: (o: {
        client_id: string;
        scope: string;
        callback: (r: TokenResponse) => void;
        error_callback?: (e: { type: string }) => void;
      }) => { requestAccessToken: (o?: { prompt?: string }) => void };
    };
  };
  picker: {
    PickerBuilder: new () => PickerBuilder;
    DocsView: new (viewId?: unknown) => { setIncludeFolders: (v: boolean) => unknown; setMode?: (m: unknown) => unknown };
    ViewId: { DOCS: unknown };
    Feature: { MULTISELECT_ENABLED: unknown };
    Action: { PICKED: string; CANCEL: string };
    Response: { ACTION: string; DOCUMENTS: string };
    Document: { ID: string; NAME: string; URL: string; MIME_TYPE: string; ICON_URL: string };
  };
};
type PickerBuilder = {
  addView: (v: unknown) => PickerBuilder;
  setOAuthToken: (t: string) => PickerBuilder;
  setDeveloperKey: (k: string) => PickerBuilder;
  setAppId: (id: string) => PickerBuilder;
  setLocale: (l: string) => PickerBuilder;
  enableFeature: (f: unknown) => PickerBuilder;
  setTitle: (t: string) => PickerBuilder;
  setCallback: (cb: (data: Record<string, unknown>) => void) => PickerBuilder;
  build: () => { setVisible: (v: boolean) => void };
};
type Gapi = { load: (lib: string, cb: () => void) => void };

declare global {
  interface Window {
    google?: GoogleGlobal;
    gapi?: Gapi;
  }
}

const scripts = new Map<string, Promise<void>>();
function loadScript(src: string) {
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

let cached: { token: string; expires: number } | null = null;

/** Token z zakresem drive.file. Pierwszy raz otwiera okno zgody Google; potem do wygaśnięcia działa bez okna. */
export async function getDriveToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  await loadScript("https://accounts.google.com/gsi/client");
  const g = window.google;
  if (!g?.accounts) throw new Error("Usługa logowania Google nie odpowiada.");
  return new Promise((resolve, reject) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: cfg.clientId,
      scope: DRIVE_SCOPE,
      callback: (r) => {
        if (!r.access_token) return reject(new Error(r.error === "access_denied" ? "Nie udzielono dostępu do Dysku." : "Google nie wydał dostępu."));
        cached = { token: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000 };
        resolve(r.access_token);
      },
      error_callback: (e) => reject(new Error(e.type === "popup_closed" ? "Zamknięto okno Google." : "Nie udało się otworzyć okna Google.")),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

export type PickedFile = { id: string; name: string; url: string; mimeType: string };

/** Okno wyboru plików z Dysku. Zwraca pustą listę, gdy użytkownik zamknie okno. */
export async function pickDriveFiles(): Promise<PickedFile[]> {
  const token = await getDriveToken();
  await loadScript("https://apis.google.com/js/api.js");
  await new Promise<void>((resolve) => window.gapi!.load("picker", resolve));
  const p = window.google!.picker;

  return new Promise((resolve) => {
    const view = new p.DocsView(p.ViewId.DOCS);
    view.setIncludeFolders(true);
    new p.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(cfg.apiKey)
      .setAppId(cfg.appId)
      .setLocale("pl")
      .setTitle("Wybierz pliki do materiału")
      .enableFeature(p.Feature.MULTISELECT_ENABLED)
      .setCallback((data) => {
        const action = data[p.Response.ACTION];
        if (action === p.Action.CANCEL) return resolve([]);
        if (action !== p.Action.PICKED) return;
        const docs = (data[p.Response.DOCUMENTS] as Record<string, string>[]) ?? [];
        resolve(
          docs.map((d) => ({
            id: d[p.Document.ID],
            name: d[p.Document.NAME],
            url: d[p.Document.URL],
            mimeType: d[p.Document.MIME_TYPE],
          })),
        );
      })
      .build()
      .setVisible(true);
  });
}

/** Nowy dokument Google Docs z HTML (Drive konwertuje nagłówki, listy i pogrubienia). Zwraca link do edycji. */
export async function createGoogleDoc(title: string, html: string): Promise<{ id: string; url: string }> {
  const token = await getDriveToken();
  const boundary = `cf${Math.random().toString(36).slice(2)}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: title, mimeType: "application/vnd.google-apps.document" }) +
    `\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n` +
    `<html><head><meta charset="utf-8"></head><body>${html}</body></html>` +
    `\r\n--${boundary}--`;

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) {
    if (res.status === 401) cached = null;
    throw new Error(res.status === 403 ? "Dysk odmówił dostępu. Sprawdź, czy Drive API jest włączone." : "Nie udało się utworzyć dokumentu.");
  }
  const data = (await res.json()) as { id: string; webViewLink: string };
  return { id: data.id, url: data.webViewLink };
}
