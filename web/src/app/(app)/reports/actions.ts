"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createReportSchedule, deleteReportSchedule, getSessionUser } from "@/lib/db";

export type ScheduleFormState = { status: "idle" | "ok" | "error"; error?: string };

const SECTIONS = ["summary", "audience", "reach", "engagement", "formats", "top", "insights"] as const;

const schema = z.object({
  brandId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["month", "year", "campaign", "custom"]),
  frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  recipients: z
    .string()
    .transform((s) => [...new Set(s.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))])
    .pipe(z.array(z.string().email()).min(1).max(20)),
  locale: z.enum(["fr", "en"]),
  format: z.enum(["pdf", "pptx", "csv"]),
  networks: z.array(z.enum(["ig", "fb"])).min(1),
  sections: z.array(z.enum(SECTIONS)).min(1),
  compare: z.boolean(),
});

/** Programmer un envoi automatique (agence uniquement ; RLS report_schedules_all). */
export async function createScheduleAction(_prev: ScheduleFormState, fd: FormData): Promise<ScheduleFormState> {
  const user = await getSessionUser();
  if (!user?.isAgency) return { status: "error", error: "forbidden" };
  const parsed = schema.safeParse({
    brandId: fd.get("brandId"),
    name: fd.get("name"),
    kind: fd.get("kind"),
    frequency: fd.get("frequency"),
    recipients: fd.get("recipients") ?? "",
    locale: fd.get("locale"),
    format: fd.get("format"),
    networks: fd.getAll("networks"),
    sections: fd.getAll("sections"),
    compare: fd.get("compare") === "on",
  });
  if (!parsed.success) {
    const recipientsIssue = parsed.error.issues.some((i) => i.path[0] === "recipients");
    return { status: "error", error: recipientsIssue ? "recipients" : "invalid" };
  }
  const res = await createReportSchedule(parsed.data);
  if (!res.ok) return { status: "error", error: res.error };
  revalidatePath("/reports");
  return { status: "ok" };
}

export async function deleteScheduleAction(fd: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user?.isAgency) return;
  const id = z.string().uuid().safeParse(fd.get("id"));
  if (!id.success) return;
  await deleteReportSchedule(id.data);
  revalidatePath("/reports");
}
