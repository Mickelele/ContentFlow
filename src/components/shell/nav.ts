import {
  CalendarDays,
  ChartColumn,
  CheckSquare,
  Clapperboard,
  FolderKanban,
  Lightbulb,
  Settings,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV: NavItem[] = [
  { href: "dzis", label: "Dziś", icon: Sun },
  { href: "kalendarz", label: "Kalendarz", icon: CalendarDays },
  { href: "content", label: "Content", icon: Clapperboard },
  { href: "zadania", label: "Zadania", icon: CheckSquare },
  { href: "klienci", label: "Klienci", icon: Users },
  { href: "projekty", label: "Projekty", icon: FolderKanban },
  { href: "pomysly", label: "Notatki i pomysły", icon: Lightbulb },
  { href: "podsumowanie", label: "Podsumowanie", icon: ChartColumn },
];

export const SETTINGS: NavItem = { href: "ustawienia", label: "Ustawienia", icon: Settings };

/** Na telefonie w dolnym pasku są tylko najczęstsze; reszta trafia do „Więcej”. */
export const MOBILE_PRIMARY = ["dzis", "kalendarz", "content"];
