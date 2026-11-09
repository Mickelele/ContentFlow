"use client";

import { useState } from "react";
import { FileText, HardDrive, Loader2 } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { googleConfigured } from "@/lib/google";
import { createGoogleDoc, pickDriveFiles, type PickedFile } from "@/lib/google-drive";

/** „Z Dysku”: wybór plików w oknie Google. Ukryty, dopóki Google nie jest skonfigurowany. */
export function DrivePickButton({ onPicked, onError }: { onPicked: (files: PickedFile[]) => Promise<void>; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  if (!googleConfigured) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const files = await pickDriveFiles();
          if (files.length) await onPicked(files);
        } catch (e) {
          onError(e instanceof Error ? e.message : "Nie udało się otworzyć Dysku.");
        } finally {
          setBusy(false);
        }
      }}
      className={buttonClass("ghost", "h-8 px-2.5 text-[13px]")}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <HardDrive className="size-4" aria-hidden="true" />}
      Z Dysku
    </button>
  );
}

/** „Do Google Docs”: tworzy dokument ze scenariusza i zwraca jego link. */
export function ExportDocButton({
  title,
  getHtml,
  onCreated,
  onError,
}: {
  title: string;
  getHtml: () => string;
  onCreated: (doc: { id: string; url: string }) => Promise<void>;
  onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!googleConfigured) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onMouseDown={(e) => e.preventDefault()}
      onClick={async () => {
        setBusy(true);
        try {
          const doc = await createGoogleDoc(title, getHtml());
          await onCreated(doc);
          window.open(doc.url, "_blank", "noopener");
        } catch (e) {
          onError(e instanceof Error ? e.message : "Nie udało się utworzyć dokumentu.");
        } finally {
          setBusy(false);
        }
      }}
      className={buttonClass("ghost", "h-8 px-2.5 text-[13px]")}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileText className="size-4" aria-hidden="true" />}
      Do Google Docs
    </button>
  );
}
