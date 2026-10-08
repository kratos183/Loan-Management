import { Clock, Gauge } from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { CibilCheck, CibilGauge, ScoreEligibility } from "@/components/cibil/cibil-check";
import { Alert } from "@/components/ui/primitives";
import { Card, CardBody } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "CIBIL Score" };

export default async function CibilPage() {
  const ctx = await loadPortal("user");
  const { user } = ctx.session;

  // Read the latest check; RLS scopes it to this user
  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("cibil_checks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const score = latest?.[0] ?? null;
  const isExpired = score ? new Date(score.expires_at) < new Date() : false;

  return (
    <Portal
      which="user"
      title="CIBIL score"
      description="Check your credit score and see which products you qualify for. Your score is only shown for a limited period."
      maxWidth="max-w-[1000px]"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {score && !isExpired ? (
            <CibilGauge
              score={score.score}
              band={score.band}
              factors={(score.factors ?? {}) as Record<string, unknown>}
              expiresAt={score.expires_at}
            />
          ) : score && isExpired ? (
            <Alert tone="warning" title="Your score has expired" icon={<Clock />}>
              It was checked on {formatDateTime(score.created_at)} and expired on{" "}
              {formatDateTime(score.expires_at)}. Bureau scores go stale, so we need a fresh
              check before you apply.{" "}
              <CibilCheck hasPan={!!user.pan} />
            </Alert>
          ) : null}

          <CibilCheck hasPan={!!user.pan} />
        </div>

        <div className="space-y-4">
          {score && !isExpired && <ScoreEligibility score={score.score} />}

          <Card>
            <CardBody className="space-y-3">
              <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
                <Gauge className="size-4 text-ink-400" />
                What the score means
              </h3>
              {[
                ["800 – 900", "Excellent", "Best rates, all products"],
                ["750 – 799", "Good", "Competitive rates"],
                ["700 – 749", "Average", "Standard rates"],
                ["300 – 699", "Poor", "Higher rates, secured only"],
              ].map(([range, label, note]) => (
                <div key={range} className="flex items-start gap-3">
                  <span className="tabular-nums w-20 shrink-0 text-[11px] font-semibold text-ink-400">
                    {range}
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-ink-800">{label}</p>
                    <p className="text-[11px] text-ink-400">{note}</p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-2 text-[13px] leading-relaxed text-ink-600">
              <h3 className="text-[13px] font-semibold text-ink-900">About the data here</h3>
              <p>
                This prototype returns a simulated bureau response. Real scores come from
                Experian, Equifax or CRIF High Mark, all of which require a signed NBFC
                agreement before you can pull a live score.
              </p>
              <p>
                A bureau enquiry needs your explicit consent. In production you would record who
                consented, when, and against which version of the disclosure.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </Portal>
  );
}