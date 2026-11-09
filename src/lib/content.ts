import { Clapperboard, Film, GalleryHorizontal, Image as ImageIcon, LayoutGrid, Shapes, type LucideIcon } from "lucide-react";

export type ContentType = "reel" | "post" | "graphic" | "video" | "carousel" | "other";
export type ContentStage = "idea" | "script" | "recording" | "editing" | "approval" | "scheduled" | "published";
export type MilestoneKind = "recording" | "editing" | "approval";
export type Platform = "instagram" | "facebook" | "tiktok" | "linkedin" | "youtube";

export const CONTENT_TYPES: Record<ContentType, { label: string; icon: LucideIcon }> = {
  reel: { label: "Rolka", icon: Clapperboard },
  post: { label: "Post", icon: LayoutGrid },
  graphic: { label: "Grafika", icon: ImageIcon },
  video: { label: "Film", icon: Film },
  carousel: { label: "Karuzela", icon: GalleryHorizontal },
  other: { label: "Inne", icon: Shapes },
};

/** Domyślna ścieżka produkcji (specyfikacja 2.4). */
export const STAGES: { key: ContentStage; label: string }[] = [
  { key: "idea", label: "Pomysł" },
  { key: "script", label: "Scenariusz" },
  { key: "recording", label: "Nagrania" },
  { key: "editing", label: "Montaż" },
  { key: "approval", label: "Akceptacja" },
  { key: "scheduled", label: "Zaplanowano" },
  { key: "published", label: "Opublikowano" },
];
export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<ContentStage, string>;
export const stageIndex = (s: ContentStage) => STAGES.findIndex((x) => x.key === s);

export const MILESTONES: { kind: MilestoneKind; label: string }[] = [
  { kind: "recording", label: "Nagranie" },
  { kind: "editing", label: "Montaż" },
  { kind: "approval", label: "Akceptacja" },
];

export const PLATFORM_LIST: { key: Platform; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "youtube", label: "YouTube" },
];

/** Szablon scenariusza rolki: hook, rozwinięcie, wezwanie do działania. */
export const REEL_TEMPLATE = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hook (pierwsze 3 sekundy)" }] },
    { type: "paragraph" },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Rozwinięcie" }] },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Wezwanie do działania" }] },
    { type: "paragraph" },
  ],
};

/** "#a, b  #c" → ["a", "b", "c"] */
export const parseHashtags = (v: string) =>
  [...new Set(v.split(/[\s,]+/).map((t) => t.replace(/^#+/, "").trim()).filter(Boolean))];
export const formatHashtags = (tags: string[]) => tags.map((t) => `#${t}`).join(" ");
