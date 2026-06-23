import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, LogOut, Shield, ListChecks } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name, email, is_active")
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => {
        const list = data ?? [];
        setProfiles(list);
        if (user) setMyProfile(list.find((p) => p.id === user.id) ?? null);
      });
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const navItem = (to: string, label: string, Icon: typeof LayoutDashboard, active: boolean) => (
    <Link
      to={to}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
        active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card/30 px-3 py-5">
        <div className="px-3 pb-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">F</div>
            <div>
              <div className="text-sm font-semibold">FP&A Hub</div>
              <div className="text-xs text-muted-foreground">Performance & Impacto</div>
            </div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {navItem("/overview", "Overview", LayoutDashboard, pathname === "/overview")}
          {user && navItem(`/tasks/${user.id}`, "Minhas tarefas", ListChecks, pathname.startsWith("/tasks/") && pathname.includes(user.id))}
          <div className="mt-3 px-3 text-xs uppercase tracking-wide text-muted-foreground">Equipe</div>
          {profiles.map((p) =>
            navItem(
              `/tasks/${p.id}`,
              p.full_name || p.email,
              Users,
              pathname === `/tasks/${p.id}`,
            ),
          )}
          {isAdmin && (
            <>
              <div className="mt-3 px-3 text-xs uppercase tracking-wide text-muted-foreground">Admin</div>
              {navItem("/admin/members", "Membros", Shield, pathname === "/admin/members")}
            </>
          )}
        </nav>
        <div className="mt-auto flex items-center gap-2 border-t pt-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials(myProfile?.full_name || user?.email || "??")}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{myProfile?.full_name || "—"}</div>
            <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
          </div>
          <Button size="icon" variant="ghost" onClick={signOut} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}