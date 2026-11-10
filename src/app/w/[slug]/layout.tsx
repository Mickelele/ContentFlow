import { AppShell } from "@/components/shell/app-shell";
import { AppearanceSync } from "@/components/shell/appearance-sync";
import { getSession, getWorkspace, getWorkspaces } from "@/lib/workspace";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/w/[slug]">) {
  const { slug } = await params;
  const [{ user, profile }, workspace, workspaces] = await Promise.all([
    getSession(),
    getWorkspace(slug),
    getWorkspaces(),
  ]);

  const email = profile?.email ?? user.email ?? "";
  return (
    <AppShell
      workspace={workspace}
      workspaces={workspaces}
      user={{ name: profile?.full_name || email.split("@")[0], email, avatar: profile?.avatar_url ?? null }}
    >
      <AppearanceSync userId={user.id} settings={profile?.settings ?? null} />
      {children}
    </AppShell>
  );
}

// Cała aplikacja zależy od sesji użytkownika, więc renderujemy ją na żądanie.
export const instant = false;
