"use server";

/**
 * Thin useActionState-compatible wrappers.
 *
 * The decision and approval actions take a raw FormData (they are used as
 * plain form actions in some places). `useActionState` needs the
 * (prevState, formData) signature, so we adapt here rather than duplicating
 * the business logic.
 */

import {
  decideApplication as decideApplicationRaw,
  submitApplication as submitApplicationRaw,
  createApplicationAction,
  saveDocument as saveDocumentRaw,
  completePart as completePartRaw,
  reviewDocument as reviewDocumentRaw,
} from "./applications";

export interface ActionResult {
  success?: boolean;
  loanId?: string;
  id?: string;
  next?: string;
  error?: string;
}

export async function decideApplication(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    return await decideApplicationRaw(formData);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "The decision could not be saved.",
    };
  }
}

export async function submitApplication(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await submitApplicationRaw(String(formData.get("application_id")));
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not submit the application.",
    };
  }
}

export async function startApplication(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return createApplicationAction(formData);
}

export async function saveDocumentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const part = String(formData.get("part")) as never;
    const file = formData.get("file") as File | null;

    await saveDocumentRaw({
      applicationId: String(formData.get("application_id")),
      part,
      sectionKey: String(formData.get("section_key")),
      docType: String(formData.get("doc_type")),
      value: String(formData.get("value") ?? ""),
      fileName: file && file.size > 0 ? file.name : undefined,
      filePath: file && file.size > 0 ? `uploads/${file.name}` : undefined,
      fileUrl: file && file.size > 0 ? URL.createObjectURL(file) : undefined,
    });

    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not save that document.",
    };
  }
}

export async function completePartAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const result = await completePartRaw(
      String(formData.get("application_id")),
      String(formData.get("part")) as never,
    );
    return result as ActionResult;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not advance the application.",
    };
  }
}

export async function reviewDocumentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await reviewDocumentRaw({
      documentId: String(formData.get("document_id")),
      decision: String(formData.get("decision")) as never,
      reason: String(formData.get("reason") ?? "") || undefined,
    });
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not record that decision.",
    };
  }
}

/** Role / status changes from the admin user-management screen. */
export async function updateUserAccessAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { updateUserAccess } = await import("@/lib/actions/auth");
  try {
    return await updateUserAccess(formData);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not update this account.",
    };
  }
}

/** Claim or resolve a support ticket from the employee queue. */
export async function updateTicketAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { updateTicketStatus } = await import("@/lib/actions/chat");
  try {
    return await updateTicketStatus(
      String(formData.get("ticket_id")),
      String(formData.get("status") ?? "IN_PROGRESS"),
      String(formData.get("resolution") ?? "") || undefined,
    );
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not update this ticket.",
    };
  }
}

/** Approve or decline an NOC request. */
export async function decideNocAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { decideNoc } = await import("@/lib/actions/chat");
  try {
    return await decideNoc(
      String(formData.get("noc_id")),
      String(formData.get("decision")) as "APPROVED" | "REJECTED",
      String(formData.get("note") ?? "") || undefined,
    );
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not record that decision.",
    };
  }
}

/** Flag an instalment overdue and notify the borrower. */
export async function flagOverdueAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { flagOverdue } = await import("@/lib/actions/chat");
  try {
    return await flagOverdue(String(formData.get("emiId")));
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not flag that instalment.",
    };
  }
}