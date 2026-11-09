"use client";

import dynamic from "next/dynamic";
import { PageSkeleton } from "@/components/page-skeleton";

// Grupy „Dziś / Jutro / Zaległe” zależą od daty i strefy czasowej przeglądarki.
export const TasksLoader = dynamic(() => import("./tasks-app").then((m) => m.TasksApp), {
  ssr: false,
  loading: () => <PageSkeleton />,
});
