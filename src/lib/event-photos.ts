import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Zdjęcia w wydarzeniach: pliki w prywatnym koszyku Supabase Storage „event-photos”,
 * ścieżka <workspace_id>/<event_id>/<uuid>.webp, wiersze w event_photos. Zob. D-35.
 */
export const PHOTO_BUCKET = "event-photos";
const MAX_SIDE = 1600;
export const MAX_PHOTOS = 12;

export type EventPhoto = { id: string; path: string; width: number | null; height: number | null; url: string };

/** Pomniejsza zdjęcie w przeglądarce (dłuższy bok maks. 1600 px) i zapisuje jako WebP. */
async function shrink(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) throw new Error("Nie udało się przetworzyć zdjęcia.");
  return { blob, width, height };
}

export async function uploadEventPhotos(supabase: SupabaseClient, workspaceId: string, eventId: string, files: File[], startPosition = 0) {
  let failed = 0;
  for (const [i, file] of files.entries()) {
    try {
      if (!file.type.startsWith("image/")) throw new Error("To nie jest zdjęcie.");
      const { blob, width, height } = await shrink(file);
      const path = `${workspaceId}/${eventId}/${crypto.randomUUID()}.webp`;
      const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (up.error) throw up.error;
      const ins = await supabase.from("event_photos").insert({ event_id: eventId, path, width, height, position: startPosition + i });
      if (ins.error) {
        await supabase.storage.from(PHOTO_BUCKET).remove([path]);
        throw ins.error;
      }
    } catch {
      failed++;
    }
  }
  return failed;
}

/** Zdjęcia wydarzenia z podpisanymi adresami (ważne godzinę). */
export async function listEventPhotos(supabase: SupabaseClient, eventId: string): Promise<EventPhoto[]> {
  const { data } = await supabase.from("event_photos").select("id, path, width, height").eq("event_id", eventId).order("position").order("created_at");
  const rows = data ?? [];
  if (!rows.length) return [];
  const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(
    rows.map((r) => r.path),
    3600,
  );
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.flatMap((r) => (urlByPath.get(r.path) ? [{ ...r, url: urlByPath.get(r.path)! }] : []));
}

export async function deleteEventPhoto(supabase: SupabaseClient, photo: Pick<EventPhoto, "id" | "path">) {
  const { error } = await supabase.from("event_photos").delete().eq("id", photo.id);
  if (!error) await supabase.storage.from(PHOTO_BUCKET).remove([photo.path]);
  return !error;
}

/** Ścieżki plików wydarzenia — pobierz przed usunięciem wydarzenia (potem kaskada usunie wiersze). */
export async function eventPhotoPaths(supabase: SupabaseClient, eventId: string) {
  const { data } = await supabase.from("event_photos").select("path").eq("event_id", eventId);
  return (data ?? []).map((r) => r.path as string);
}

export async function removePhotoFiles(supabase: SupabaseClient, paths: string[]) {
  if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
}
