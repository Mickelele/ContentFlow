"use client";

import { DRIVE_SCOPE, google as cfg } from "@/lib/google";
import { forgetToken, getGoogleToken, loadScript } from "@/lib/google-auth";

/*
 * Dysk Google po stronie przeglądarki, bez przechowywania tokenów (D-08, D-05).
 * 1. Google Identity Services wydaje krótkotrwały token (ok. 1 h) z zakresem drive.file.
 * 2. Google Picker pokazuje pliki użytkownika; widzimy tylko to, co wskaże.
 * 3. Drive API tworzy dokument Google Docs z HTML scenariusza.
 * Token trzymamy wyłącznie w pamięci karty.
 */

type GooglePicker = {
  picker: {
    PickerBuilder: new () => PickerBuilder;
    DocsView: new (viewId?: unknown) => { setIncludeFolders: (v: boolean) => unknown };
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

const getDriveToken = () => getGoogleToken(DRIVE_SCOPE);

export type PickedFile = { id: string; name: string; url: string; mimeType: string };

/** Okno wyboru plików z Dysku. Zwraca pustą listę, gdy użytkownik zamknie okno. */
export async function pickDriveFiles(): Promise<PickedFile[]> {
  const token = await getDriveToken();
  await loadScript("https://apis.google.com/js/api.js");
  const w = window as unknown as { gapi: Gapi; google: GooglePicker };
  await new Promise<void>((resolve) => w.gapi.load("picker", resolve));
  const p = w.google.picker;

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
    if (res.status === 401) forgetToken(DRIVE_SCOPE);
    throw new Error(res.status === 403 ? "Dysk odmówił dostępu. Sprawdź, czy Drive API jest włączone." : "Nie udało się utworzyć dokumentu.");
  }
  const data = (await res.json()) as { id: string; webViewLink: string };
  return { id: data.id, url: data.webViewLink };
}
