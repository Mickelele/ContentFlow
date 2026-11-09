export type ProjectStatus = "active" | "paused" | "done" | "archived";

export type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  client_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
  content_count: number;
  task_count: number;
};

export const PROJECT_STATUS: Record<ProjectStatus, string> = {
  active: "W toku",
  paused: "Wstrzymany",
  done: "Zakończony",
  archived: "Archiwum",
};
