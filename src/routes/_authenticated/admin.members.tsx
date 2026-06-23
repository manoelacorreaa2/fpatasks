import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { inviteMember, setMemberActive } from "@/lib/members.functions";
import { runSnapshotNow } from "@/lib/snapshots.functions";

export const Route = createFileRoute("/_authenticated/admin/members")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roles) throw redirect({ to: "/overview" });
  },
  component: AdminMembers,
});

function AdminMembers() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const invite = useServerFn(inviteMember);
  const setActive = useServerFn(setMemberActive);
  const runSnap = useServerFn(runSnapshotNow);
  const [pending, setPending] = useState(false);
  const [snapPending, setSnapPending] = useState(false);

  const membersQ = useQuery({
    queryKey: ["all_members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, is_active, created_at")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName) return;
    setPending(true);
    try {
      const res = await invite({ data: { email, fullName } });
      if (res.ok) {
        toast.success("Convite enviado");
        setEmail(""); setFullName("");
        qc.invalidateQueries({ queryKey: ["all_members"] });
      } else {
        toast.error(res.error ?? "Falha");
      }
    } finally { setPending(false); }
  };

  const toggle = async (id: string, active: boolean) => {
    const res = await setActive({ data: { userId: id, active } });
    if (res.ok) { toast.success(active ? "Membro ativado" : "Membro desativado"); qc.invalidateQueries({ queryKey: ["all_members"] }); }
    else toast.error(res.error ?? "Falha");
  };

  const handleSnapshot = async () => {
    setSnapPending(true);
    try {
      const res = await runSnap({ data: {} });
      if (res.ok) toast.success(`Snapshot gerado (${res.inserted} linhas)`);
      else toast.error(res.error ?? "Falha");
    } finally { setSnapPending(false); }
  };

  return (
    <div className="space-y-6 p-6 md:p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Admin · Membros</h1>
        <p className="text-sm text-muted-foreground">Convide novos membros e gerencie a equipe.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Convidar membro</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <Label className="text-xs">Nome completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex: Emeline" required />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.com" required />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Convidar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Membros</CardTitle>
          <Button variant="outline" size="sm" onClick={handleSnapshot} disabled={snapPending}>
            {snapPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Rodar snapshot agora
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(membersQ.data ?? []).map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-md border p-3">
                <Avatar><AvatarFallback>{initials(m.full_name || m.email)}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{m.full_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{m.is_active ? "Ativo" : "Inativo"}</span>
                  <Switch checked={m.is_active} onCheckedChange={(v) => toggle(m.id, v)} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}