"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { pullCibilScore } from "@/lib/services/cibil";

export async function fetchCibilScore() {
  const session = await requireSession();

  // KYC gate: the bureau needs a PAN to run a check
  if (!session.user.pan) {
    return {
      error:
        "Add your PAN to your profile before checking your credit score. It's needed for the bureau enquiry and for disbursement.",
    };
  }

  try {
    const result = await pullCibilScore(session.user.id, session.user.pan);
    revalidatePath("/user/cibil");
    revalidatePath("/user/dashboard");
    return { success: true, score: result.score };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not reach the credit bureau. Try again.",
    };
  }
}