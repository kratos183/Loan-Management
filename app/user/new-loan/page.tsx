import Link from "next/link";
import { ArrowRight, Info, Lock } from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { listActiveProducts, getActiveCoolingPeriod } from "@/lib/queries/applications";
import { Card } from "@/components/ui/card";
import { Badge, CategoryBadge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/primitives";
import { money, moneyCompact, percent, tenure } from "@/lib/format";
import { calculateEmi } from "@/lib/finance/emi";
import type { LoanCategory } from "@/lib/db/types";

export const metadata = { title: "New Loan" };

const CATEGORY_COPY: Record<LoanCategory, { blurb: string; note: string }> = {
  SECURED: {
    blurb: "Backed by an asset you pledge.",
    note: "Lower rates and longer tenures. Verification includes a collateral check.",
  },
  UNSECURED: {
    blurb: "Based on your income and credit profile.",
    note: "No collateral. Approval depends on FOIR, credit score and employer profile.",
  },
};

export default async function NewLoanPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; category?: string }>;
}) {
  const ctx = await loadPortal("user");
  const params = await searchParams;
  const userId = ctx.session.user.id;

  const products = await listActiveProducts();

  // A rejected applicant is blocked from the SAME category for 90 days
  const [securedBlock, unsecuredBlock] = await Promise.all([
    getActiveCoolingPeriod(userId, "SECURED"),
    getActiveCoolingPeriod(userId, "UNSECURED"),
  ]);

  const blocks: Record<LoanCategory, typeof securedBlock> = {
    SECURED: securedBlock,
    UNSECURED: unsecuredBlock,
  };

  const categories: LoanCategory[] = ["SECURED", "UNSECURED"];

  return (
    <Portal
      which="user"
      title="Apply for a new loan"
      description="Pick a product to start. You'll only be asked for documents that loan actually needs."
      maxWidth="max-w-[1200px]"
    >
      <div className="space-y-8">
        {categories.map((category) => {
          const inCategory = products.filter((p) => p.category === category);
          const block = blocks[category];

          return (
            <section key={category}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-semibold tracking-tight text-ink-900">
                      {category === "SECURED" ? "Secured loans" : "Unsecured loans"}
                    </h2>
                    <CategoryBadge category={category} />
                  </div>
                  <p className="mt-1 text-sm text-ink-500">{CATEGORY_COPY[category].blurb}</p>
                </div>
              </div>

              {/* 3-month cooling-off after a rejection (source doc lines 123-125) */}
              {block && (
                <Alert tone="warning" title="Temporarily unavailable for you" icon={<Info />} className="mb-4">
                  Your last {category.toLowerCase()} application was declined on{" "}
                  {new Date(block.starts_at).toLocaleDateString("en-IN")}. You can apply again in this
                  category from{" "}
                  <strong>{new Date(block.expires_at).toLocaleDateString("en-IN")}</strong>. Other
                  categories are unaffected.
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {inCategory.map((product) => {
                  const midRate = (product.min_rate + product.max_rate) / 2;
                  const midAmount = (product.min_amount + product.max_amount) / 2;
                  const midTenure = Math.round(
                    (product.min_tenure_months + product.max_tenure_months) / 2,
                  );
                  const indicative = calculateEmi(midAmount, midRate, midTenure);

                  return (
                    <Card
                      key={product.id}
                      className="flex flex-col p-5 transition-all hover:border-brand-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-3xl">{product.thumbnail_emoji}</span>
                        {product.collateral_type !== "NONE" && (
                          <Badge tone="brand">
                            {product.collateral_type.charAt(0) + product.collateral_type.slice(1).toLowerCase()}
                          </Badge>
                        )}
                      </div>

                      <h3 className="mt-3 text-[15px] font-semibold text-ink-900">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-500">
                          {product.description}
                        </p>
                      )}

                      <dl className="mt-4 space-y-1.5 border-t border-ink-100 pt-3.5 text-[13px]">
                        <div className="flex justify-between">
                          <dt className="text-ink-500">Amount</dt>
                          <dd className="tabular-nums font-medium text-ink-800">
                            {moneyCompact(product.min_amount)} –{" "}
                            {moneyCompact(product.max_amount)}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-ink-500">Tenure</dt>
                          <dd className="tabular-nums font-medium text-ink-800">
                            {product.min_tenure_months} – {product.max_tenure_months} mo
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-ink-500">Interest</dt>
                          <dd className="tabular-nums font-medium text-ink-800">
                            {percent(product.min_rate)} – {percent(product.max_rate)}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-3.5 rounded-lg bg-ink-50 px-3 py-2">
                        <p className="text-[11px] text-ink-500">Indicative EMI</p>
                        <p className="tabular-nums text-[15px] font-semibold text-ink-900">
                          {money(indicative)}
                          <span className="ml-1 text-[11px] font-normal text-ink-400">
                            /mo for {tenure(midTenure)}
                          </span>
                        </p>
                      </div>

                      {block ? (
                        <Button
                          className="mt-4"
                          fullWidth
                          disabled
                          icon={<Lock className="size-4" />}
                        >
                          Locked for 90 days
                        </Button>
                      ) : (
                        <LinkButton href={`/user/new-loan/${product.id}`} className="mt-4" fullWidth>
                          Apply now
                          <ArrowRight className="size-4" />
                        </LinkButton>
                      )}

                      <p className="mt-2.5 text-center text-[11px] leading-relaxed text-ink-400">
                        Approval in {product.sla_min_days}–{product.sla_max_days} working days
                      </p>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </Portal>
  );
}