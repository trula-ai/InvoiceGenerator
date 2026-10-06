"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/current-user";
import { sendClientStatementEmail, type SendStatementResult } from "@/lib/email/send-statement";
import type { ActionResult } from "@/lib/validation/common";

import { failure, validationFailure } from "./utils";

const schema = z.object({
  to: z.email("Enter a valid email address").trim().toLowerCase().optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional(),
});

/** Emails a client a statement of every outstanding invoice, PDFs attached. */
export async function sendClientStatementAction(clientId: string, input: { to?: string; message?: string }): Promise<ActionResult<SendStatementResult>> {
  const { business } = await requireUser();
  if (!z.uuid().safeParse(clientId).success) return { ok: false, error: "Invalid client." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const result = await sendClientStatementEmail(business.id, clientId, {
      to: parsed.data.to || undefined,
      message: parsed.data.message || undefined,
    });
    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard/clients");
    revalidatePath(`/dashboard/clients/${clientId}`);
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard/notifications");
    return { ok: true, data: result };
  } catch (error) {
    return failure(error, "Could not send the statement.");
  }
}
