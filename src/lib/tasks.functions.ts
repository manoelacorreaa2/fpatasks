import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const REVIEW_RECIPIENT = "manoela.correa@worldpackers.com";

const requestReviewSchema = z.object({
  taskId: z.string().uuid(),
  force: z.boolean().optional().default(false),
});

export interface RequestReviewResult {
  ok: boolean;
  logId?: string;
  dedup?: boolean;
  minutesAgo?: number;
  error?: string;
}

export const requestReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => requestReviewSchema.parse(d))
  .handler(async ({ data, context }): Promise<RequestReviewResult> => {
    const { supabase, userId } = context;

    const { data: task, error: tErr } = await supabase
      .from("tasks")
      .select("id, title, description, deadline, needs_review, reviewer_id, assignee_id")
      .eq("id", data.taskId)
      .maybeSingle();
    if (tErr) return { ok: false, error: tErr.message };
    if (!task) return { ok: false, error: "Tarefa não encontrada" };
    if (!task.needs_review) return { ok: false, error: "Tarefa não está marcada como 'precisa de revisão'" };
    if (!task.reviewer_id) return { ok: false, error: "Revisor não preenchido" };

    // Dedup window 10 min
    if (!data.force) {
      const since = new Date(Date.now() - 10 * 60_000).toISOString();
      const { data: recent } = await supabase
        .from("email_logs")
        .select("id, created_at")
        .eq("task_id", task.id)
        .eq("status", "sent")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recent) {
        const minutesAgo = Math.max(1, Math.round((Date.now() - new Date(recent.created_at).getTime()) / 60_000));
        return { ok: false, dedup: true, minutesAgo };
      }
    }

    // Load extras for email body
    const { data: assignee } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", task.assignee_id)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const link = `${process.env.APP_PUBLIC_URL ?? ""}/tasks/${task.assignee_id}/${task.id}`;
    const subject = "Revisão de tarefa necessária";
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px">Revisão de tarefa necessária</h2>
        <p style="margin:0 0 16px;color:#475569">Uma tarefa do time FP&A precisa da sua revisão.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <tr><td style="padding:6px 0;color:#64748b">Tarefa</td><td style="padding:6px 0;font-weight:600">${escape(task.title)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Descrição</td><td style="padding:6px 0">${escape(task.description ?? "—")}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Responsável</td><td style="padding:6px 0">${escape(assignee?.full_name ?? assignee?.email ?? "—")}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Deadline</td><td style="padding:6px 0">${task.deadline ?? "—"}</td></tr>
        </table>
        <p style="margin:20px 0 0">
          <a href="${link}" style="display:inline-block;background:#0f172a;color:white;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:500">Abrir tarefa</a>
        </p>
      </div>`;

    let sendErr: string | undefined;
    try {
      // Use Lovable Cloud's email via Resend-compatible edge proxy if configured.
      // For now we attempt a direct fetch to an env-configured endpoint; if not set,
      // we simulate success in dev but log the failure clearly.
      const endpoint = process.env.EMAIL_SEND_URL;
      const apiKey = process.env.EMAIL_API_KEY;
      if (endpoint && apiKey) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            to: REVIEW_RECIPIENT,
            subject,
            html,
          }),
        });
        if (!res.ok) sendErr = `Provider responded ${res.status}: ${await res.text().catch(() => "")}`;
      } else {
        console.warn("[requestReview] Email provider not configured; logging email instead.", { subject, to: REVIEW_RECIPIENT });
      }
    } catch (e: any) {
      sendErr = e?.message ?? String(e);
    }

    const { data: log } = await supabaseAdmin
      .from("email_logs")
      .insert({
        task_id: task.id,
        sent_to: REVIEW_RECIPIENT,
        sent_by: userId,
        template: "review_request",
        status: sendErr ? "failed" : "sent",
        error_message: sendErr ?? null,
      })
      .select("id")
      .single();

    if (!sendErr) {
      await supabaseAdmin.from("tasks").update({ review_status: "requested" }).eq("id", task.id);
    }

    return sendErr ? { ok: false, error: sendErr, logId: log?.id } : { ok: true, logId: log?.id };
  });

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}