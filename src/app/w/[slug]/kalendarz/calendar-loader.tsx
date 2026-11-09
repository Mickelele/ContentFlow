"use client";

import dynamic from "next/dynamic";
import { PageSkeleton } from "@/components/page-skeleton";

// Kalendarz renderuje się tylko w przeglądarce: zależy od szerokości ekranu, strefy czasowej
// i ustawień z localStorage, więc wersja z serwera i tak różniłaby się od tej po załadowaniu.
export const CalendarLoader = dynamic(() => import("./calendar-app").then((m) => m.CalendarApp), {
  ssr: false,
  loading: () => <PageSkeleton />,
});
