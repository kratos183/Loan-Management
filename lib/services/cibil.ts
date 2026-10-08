import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { cibilBand } from "@/lib/finance/risk";
import type { CibilBand } from "@/lib/db/types";

/**
 * Credit bureau integration.
 *
 * Real providers in India are Experian, Equifax and CRIF High Mark. All three
 * require a signed NBFC agreement, so this prototype mocks the response
 * behind the same interface. Swapping in a real call means replacing
 * `fetchFromProvider` and nothing else.
 *
 * Score is only valid for a window (`VALIDITY_DAYS`); after that the user must
 * re-validate. That mirrors how bureau consent works in practice.
 */

const VALIDITY_DAYS = 30;
const SCORE_EXPIRY_DAYS = 30;

export interface CibilResult {
  score: number;
  band: CibilBand;
  factors: {
    paymentHistory: number;
    creditUtilisation: number;
    accountAgeYears: number;
    hardQueries: number;
  };
  rawResponse: Record<string, unknown>;
  expiresAt: string;
  provider: string;
}

interface ProviderResponse {
  score: number;
  factors: CibilResult["factors"];
  raw: Record<string, unknown>;
}

/**
 * Deterministic pseudo-score derived from the PAN, so the same applicant gets
 * a stable score across reloads. A real bureau is not random.
 */
async function fetchFromProvider(pan: string): Promise<ProviderResponse> {
  const provider = process.env.CIBIL_PROVIDER ?? "mock";

  if (provider !== "mock" && process.env.CIBIL_API_BASE_URL) {
    // ── Real provider path (skeleton) ──────────────────────────────────────
    // const res = await fetch(`${process.env.CIBIL_API_BASE_URL}/score`, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${process.env.CIBIL_API_KEY}`,
    //   },
    //   body: JSON.stringify({ pan, consent: true }),
    // });
    // if (!res.ok) throw new Error(`Bureau returned ${res.status}`);
    // const data = await res.json();
    // return { score: data.score, factors: data.factors, raw: data };
  }

  // ── Mock path ────────────────────────────────────────────────────────────
  const seed = hashString(pan);
  const score = 620 + (seed % 260); // 620 – 879, spread across all four bands

  return {
    score,
    factors: {
      // Stronger score → better history
      paymentHistory: Math.min(100, 70 + (score - 620) / 6),
      creditUtilisation: Math.round(12 + ((seed >> 3) % 70)),
      accountAgeYears: 1 + ((seed >> 7) % 14),
      hardQueries: (seed >> 11) % 8,
    },
    raw: {
      _mock: true,
      requestId: `MOCK-${seed.toString(16).toUpperCase()}`,
      pan: `${pan.slice(0, 3)}XXXXX${pan.slice(-1)}`,
      bureau: "MOCK_BUREAU",
      retrievedAt: new Date().toISOString(),
    },
  };
}

/**
 * Pull a score and persist it.
 *
 * Requires the user's PAN. In production this would be preceded by a consent
 * screen — recording who consented, when, and against which version.
 */
export async function pullCibilScore(userId: string, pan: string): Promise<CibilResult> {
  if (!pan || pan.length < 5) {
    throw new Error("A PAN is required to run a bureau check. Complete your KYC first.");
  }

  const response = await fetchFromProvider(pan.toUpperCase());
  const band = cibilBand(response.score);
  const expiresAt = new Date(
    Date.now() + SCORE_EXPIRY_DAYS * 86_400_000,
  ).toISOString();

  // service role: RLS would otherwise block inserting on someone else's behalf,
  // but this is the user's own record so the caller's session is fine too.
  const admin = createAdminClient();

  const { error } = await admin.from("cibil_checks").insert({
    user_id: userId,
    pan: pan.toUpperCase(),
    score: response.score,
    band,
    provider: process.env.CIBIL_PROVIDER ?? "mock",
    factors: response.factors,
    raw_response: response.raw,
    expires_at: expiresAt,
  });

  if (error) throw new Error(`Could not save the score: ${error.message}`);

  // Notify the user so they see it without reloading
  await admin.from("notifications").insert({
    user_id: userId,
    type: "CIBIL",
    title: `Your credit score is ${response.score}`,
    body: `Band: ${band}. This score is valid for ${SCORE_EXPIRY_DAYS} days.`,
    link: "/user/cibil",
  });

  return {
    score: response.score,
    band,
    factors: response.factors,
    rawResponse: response.raw,
    expiresAt,
    provider: process.env.CIBIL_PROVIDER ?? "mock",
  };
}

/** The most recent score, or null if there is none or it has expired. */
export async function getActiveScore(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("cibil_checks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  const row = data?.[0] ?? null;
  if (!row) return { score: null as never, isExpired: false };

  return {
    score: row,
    isExpired: new Date(row.expires_at) < new Date(),
  };
}

/** Products the given score qualifies for. */
export function eligibilityForScore(score: number) {
  return [
    {
      label: "Best available rates",
      products: "Home, Loan Against Property",
      needs: "≥ 750",
      ok: score >= 750,
    },
    {
      label: "Standard rates",
      products: "Vehicle, Education, Personal",
      needs: "≥ 700",
      ok: score >= 700,
    },
    {
      label: "Higher rates",
      products: "Credit Card Loan",
      needs: "≥ 680",
      ok: score >= 680,
    },
    {
      label: "Secured loans still available",
      products: "Gold (does not check score)",
      needs: "any",
      ok: true,
    },
  ];
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}