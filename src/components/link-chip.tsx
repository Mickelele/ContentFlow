import {
  Bot,
  Box,
  Briefcase,
  Camera,
  ClipboardList,
  FileText,
  Globe,
  HardDrive,
  Hash,
  Music,
  NotebookText,
  Palette,
  PenTool,
  Play,
  Presentation,
  Sheet,
  SquareKanban,
  ThumbsUp,
  Video,
  type LucideIcon,
} from "lucide-react";
import { linkInfo, type LinkKind } from "@/lib/links";

/** Ikona + kolor rozpoznawczy serwisu (barwa marki, ikona ogólna — bez logotypów). */
const LOOK: Record<LinkKind, { icon: LucideIcon; color: string }> = {
  gdoc: { icon: FileText, color: "#4285F4" },
  gsheet: { icon: Sheet, color: "#0F9D58" },
  gslides: { icon: Presentation, color: "#F4B400" },
  gform: { icon: ClipboardList, color: "#7248B9" },
  gdrive: { icon: HardDrive, color: "#1FA463" },
  trello: { icon: SquareKanban, color: "#0C66E4" },
  slack: { icon: Hash, color: "#611F69" },
  canva: { icon: Palette, color: "#00C4CC" },
  figma: { icon: PenTool, color: "#A259FF" },
  notion: { icon: NotebookText, color: "#6B6B6B" },
  dropbox: { icon: Box, color: "#0061FE" },
  youtube: { icon: Play, color: "#FF0033" },
  instagram: { icon: Camera, color: "#E1306C" },
  tiktok: { icon: Music, color: "#25F4EE" },
  facebook: { icon: ThumbsUp, color: "#1877F2" },
  linkedin: { icon: Briefcase, color: "#0A66C2" },
  meet: { icon: Video, color: "#00897B" },
  zoom: { icon: Video, color: "#2D8CFF" },
  teams: { icon: Video, color: "#5B5FC7" },
  chatgpt: { icon: Bot, color: "#10A37F" },
  web: { icon: Globe, color: "var(--ink-3)" },
};

export function LinkIcon({ url, size = 28 }: { url: string; size?: number }) {
  const info = linkInfo(url);
  const { icon: Icon, color } = LOOK[info.kind];
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-lg"
      style={{ width: size, height: size, color, background: `color-mix(in oklch, ${color} 14%, transparent)` }}
    >
      <Icon style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2} />
    </span>
  );
}

/** Link jako wiersz: ikona serwisu, nazwa, serwis / domena pod spodem. */
export function LinkRow({ url, name, trailing }: { url: string; name?: string; trailing?: React.ReactNode }) {
  const info = linkInfo(url);
  const label = name?.trim() || info.service;
  return (
    <div className="group flex items-center gap-3 rounded-lg py-1.5">
      <LinkIcon url={url} />
      <a href={info.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium group-hover:underline">{label}</span>
        <span className="block truncate text-xs text-ink-3">{label === info.service ? info.host : info.service}</span>
      </a>
      {trailing}
    </div>
  );
}
