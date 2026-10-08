import { Package } from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { Badge, CategoryBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Alert, DataList, EmptyState, SectionTitle, StatCard } from "@/components/ui/primitives";
import { money, moneyCompact, number, percent } from "@/lib/format";
import type { LoanProduct } from "@/lib/db/types";

export const metadata = { title: "Product Config" };

/**
 * GAP 4: loan product configuration.
 *
 * Everything on this screen lives in `loan_products` — rates, tenure bands,
 * eligibility ceilings, servicing rules and the SLA window. The application
 * wizard and the underwriting scorecard both read from here, so changing a
 * rate here changes what the applicant sees and what the officer can sanction.
 */
export default async function AdminProductsPage() {
  await loadPortal("admin");
  const supabase = await createClient();

  const { data } = await supabase
    .from("loan_products")
    .select("*")
    .order("category")
    .order("sort_order")
    .overrideTypes<LoanProduct[]>();

  const products = data ?? [];
  const secured = products.filter((p) => p.category === "SECURED");
  const unsecured = products.filter((p) => p.category === "UNSECURED");

  return (
    <Portal
      which="admin"
      title="Product configuration"
      description="Rates, tenure bands, eligibility rules and document checklists for every product."
      maxWidth="max-w-[1500px]"
    >
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Live products"
          value={number(products.filter((p) => p.is_active).length)}
          sublabel={`of ${products.length} configured`}
          icon={<Package className="size-4" />}
          tone="brand"
        />
        <StatCard
          label="Secured"
          value={number(secured.length)}
          sublabel={`rates from ${percent(Math.min(...secured.map((p) => Number(p.min_rate))))}`}
          tone="info"
        />
        <StatCard
          label="Unsecured"
          value={number(unsecured.length)}
          sublabel={`rates from ${percent(Math.min(...unsecured.map((p) => Number(p.min_rate))))}`}
          tone="warning"
        />
        <StatCard
          label="Avg processing fee"
          value={percent(
            products.reduce((s, p) => s + Number(p.processing_fee_pct), 0) / products.length,
            2,
          )}
          sublabel="of principal"
          tone="positive"
        />
      </div>

      <div className="mt-8 space-y-8">
        {(
          [
            { key: "SECURED" as const, label: "Secured products", note: "Collateral-backed, lower rates and longer tenures." },
            { key: "UNSECURED" as const, label: "Unsecured products", note: "No collateral. Approval turns on income and credit." },
          ]
        ).map(({ key, label, note }) => {
          const list = products.filter((p) => p.category === key);
          if (list.length === 0) return null;

          return (
            <section key={key}>
              <SectionTitle>{label}</SectionTitle>
              <p className="mb-4 text-[13px] text-ink-500">{note}</p>

              <div className="grid gap-4 xl:grid-cols-2">
                {list.map((product) => (
                  <Card key={product.id}>
                    <CardBody className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{product.thumbnail_emoji}</span>
                          <div>
                            <h3 className="text-[15px] font-semibold text-ink-900">
                              {product.name}
                            </h3>
                            <p className="font-mono text-[11px] text-ink-400">
                              {product.code}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <Badge tone={product.is_active ? "positive" : "neutral"}>
                            {product.is_active ? "Live" : "Disabled"}
                          </Badge>
                          {product.collateral_type !== "NONE" && (
                            <Badge tone="brand">{product.collateral_type}</Badge>
                          )}
                        </div>
                      </div>

                      {/* Pricing */}
                      <div className="grid grid-cols-3 gap-3 rounded-lg bg-ink-50 p-3.5">
                        <Cell
                          label="Amount"
                          value={`${moneyCompact(product.min_amount)}–${moneyCompact(product.max_amount)}`}
                        />
                        <Cell
                          label="Tenure"
                          value={`${product.min_tenure_months}–${product.max_tenure_months} mo`}
                        />
                        <Cell
                          label="Interest"
                          value={`${percent(product.min_rate)}–${percent(product.max_rate)}`}
                        />
                      </div>

                      {/* Eligibility */}
                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                          Eligibility rules
                        </p>
                        <DataList
                          items={[
                            {
                              label: "Min income",
                              value: product.min_monthly_income
                                ? money(product.min_monthly_income)
                                : "Not required",
                            },
                            {
                              label: "Min credit score",
                              value: product.min_cibil ?? "Not required",
                            },
                            { label: "Max FOIR", value: percent(product.max_foir, 0) },
                            {
                              label: "Age",
                              value: `${product.min_age}–${product.max_age}`,
                            },
                            {
                              label: "Co-applicant",
                              value: product.requires_coapplicant ? "Required" : "Optional",
                            },
                            {
                              label: "Processing fee",
                              value: percent(product.processing_fee_pct, 1),
                            },
                          ]}
                        />
                      </div>

                      {/* Servicing + SLA — GAP 6, 9, 10 */}
                      <div className="border-t border-ink-100 pt-3.5">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                          Servicing & SLA
                        </p>
                        <DataList
                          items={[
                            {
                              label: "Grace period",
                              value: `${product.grace_days} days`,
                            },
                            {
                              label: "Late fee",
                              value: `${money(product.late_fee_flat)} or ${percent(product.late_fee_pct, 1)}`,
                            },
                            {
                              label: "Decision SLA",
                              value: `${product.sla_min_days}–${product.sla_max_days} working days`,
                            },
                            {
                              label: "Prepayment",
                              value: product.prepayment_allowed ? "Allowed" : "Blocked",
                            },
                            {
                              label: "Foreclosure",
                              value: product.foreclosure_allowed ? "Allowed" : "Blocked",
                            },
                            {
                              label: "Autopay",
                              value: product.autopay_enabled ? "Offered" : "Not offered",
                            },
                          ]}
                        />
                      </div>

                      {product.description && (
                        <p className="border-t border-ink-100 pt-3 text-[13px] leading-relaxed text-ink-500">
                          {product.description}
                        </p>
                      )}
                    </CardBody>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <Alert tone="neutral" className="mt-8" title="Editing products">
    Amount bands, tenure, rate range, eligibility ceilings, grace period, late fee and SLA
    window are all columns on <code className="font-mono">loan_products</code>. Updating them
    here changes what the applicant sees in the wizard and what the officer's scorecard will
    allow — no code deploy needed. The document checklist lives separately in{" "}
    <code className="font-mono">document_requirements</code>.
      </Alert>
    </Portal>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </p>
      <p className="tabular-nums mt-0.5 text-[13px] font-semibold text-ink-900">{value}</p>
    </div>
  );
}