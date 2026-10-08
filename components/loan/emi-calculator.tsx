"use client";

import { useMemo, useState } from "react";
import { Download, Info, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Slider } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { buildAmortization, calculateEmi, round2, totalInterest } from "@/lib/finance/emi";
import { money, moneyCompact, percent, tenure as fmtTenure } from "@/lib/format";
import { cn } from "@/lib/cn";

const PRESETS = [
  { label: "Home loan", amount: 2500000, rate: 8.6, years: 20 },
  { label: "Vehicle", amount: 500000, rate: 9.25, years: 7 },
  { label: "Personal", amount: 300000, rate: 12.5, years: 5 },
  { label: "Education", amount: 800000, rate: 9.9, years: 8 },
  { label: "Working capital", amount: 1200000, rate: 13.2, years: 4 },
];

export function EmiCalculator() {
  const [amount, setAmount] = useState(2_500_000);
  const [rate, setRate] = useState(8.6);
  const [years, setYears] = useState(20);

  const months = years * 12;

  const emi = useMemo(() => calculateEmi(amount, rate, months), [amount, rate, months]);
  const interest = useMemo(() => totalInterest(amount, rate, months), [amount, rate, months]);
  const payable = round2(amount + interest);

  const schedule = useMemo(
    () => buildAmortization({ principal: amount, annualRate: rate, months }),
    [amount, rate, months],
  );

  const principalShare = payable > 0 ? (amount / payable) * 100 : 0;

  function reset() {
    setAmount(2_500_000);
    setRate(8.6);
    setYears(20);
  }

  function downloadCsv() {
    const header = "Instalment,Due Date,Opening Balance,Principal,Interest,Total,Closing Balance";
    const rows = schedule.map((r) =>
      [
        r.installmentNo,
        r.dueDate,
        r.openingBalance.toFixed(2),
        r.principalPart.toFixed(2),
        r.interestPart.toFixed(2),
        r.amountDue.toFixed(2),
        r.closingBalance.toFixed(2),
      ].join(","),
    );

    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `emi-schedule-${amount}-${rate}pc-${months}mo.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      {/* ─── Inputs ─── */}
      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Loan parameters"
            action={
              <Button variant="ghost" size="xs" onClick={reset} icon={<RotateCcw className="size-3.5" />}>
                Reset
              </Button>
            }
          />
          <CardBody className="space-y-6">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label className="text-[13px] font-medium text-ink-700">Loan amount</label>
                <span className="tabular-nums text-sm font-semibold text-ink-900">
                  {moneyCompact(amount)}
                </span>
              </div>
              <Slider value={amount} min={10_000} max={50_000_000} step={10_000} onChange={setAmount} />
              <div className="mt-2">
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                  prefix="₹"
                  step={10_000}
                  className="tabular-nums"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label className="text-[13px] font-medium text-ink-700">Interest rate</label>
                <span className="tabular-nums text-sm font-semibold text-ink-900">
                  {percent(rate)}
                </span>
              </div>
              <Slider value={rate} min={1} max={24} step={0.05} onChange={setRate} />
              <div className="mt-2">
                <Input
                  type="number"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value) || 0)}
                  suffix="% p.a."
                  step={0.05}
                  className="tabular-nums"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label className="text-[13px] font-medium text-ink-700">Tenure</label>
                <span className="tabular-nums text-sm font-semibold text-ink-900">
                  {fmtTenure(months)}
                </span>
              </div>
              <Slider value={years} min={1} max={30} step={1} onChange={setYears} />
              <div className="mt-2">
                <Input
                  type="number"
                  value={years}
                  onChange={(e) => setYears(Math.max(1, Number(e.target.value) || 1))}
                  suffix="years"
                  className="tabular-nums"
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-700">Quick presets</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => {
                      setAmount(p.amount);
                      setRate(p.rate);
                      setYears(p.years);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      amount === p.amount && rate === p.rate && years === p.years
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-ink-300 text-ink-600 hover:bg-ink-50 hover:border-ink-400",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        <Alert tone="info" title="Reducing balance method" icon={<Info />}>
          Interest is charged only on the outstanding principal each month, not on the original
          amount. This is the method mandated for retail lending, and it is what every loan in
          this system uses.
        </Alert>
      </div>

      {/* ─── Results ─── */}
      <div className="space-y-4">
        <Card>
          <CardBody className="p-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Monthly instalment
            </p>
            <p className="tabular-nums mt-1 text-4xl font-semibold tracking-tight text-ink-900 sm:text-5xl">
              {money(emi)}
            </p>
            <p className="mt-1 text-[13px] text-ink-500">
              {fmtTenure(months)} at {percent(rate)} per annum
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Result label="Principal" value={money(amount)} />
              <Result label="Total interest" value={money(interest)} />
              <Result label="Total payable" value={money(payable)} />
            </div>

            {/* Principal vs interest split */}
            <div className="mt-6">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-ink-500">
                  Principal {principalShare.toFixed(0)}% of what you pay
                </span>
                <span className="text-ink-400">
                  Interest {(100 - principalShare).toFixed(0)}%
                </span>
              </div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-ink-100">
                <div className="bg-brand-500" style={{ width: `${principalShare}%` }} />
                <div className="bg-warning-400" style={{ width: `${100 - principalShare}%` }} />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Amortisation schedule"
            description="Principal falls, interest rises, instalment stays flat."
            action={
              <Button variant="outline" size="sm" onClick={downloadCsv} icon={<Download className="size-3.5" />}>
                CSV
              </Button>
            }
          />
          <div className="max-h-[520px] overflow-y-auto">
            <TableWrap>
              <thead>
                <tr>
                  <Th priority="hidden">#</Th>
                  <Th priority="primary">Due</Th>
                  <Th align="right" priority="normal">Principal</Th>
                  <Th align="right" priority="normal">Interest</Th>
                  <Th align="right" priority="primary">Total</Th>
                  <Th align="right" priority="normal">Balance</Th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <Tr key={row.installmentNo}>
                    <Td mono className="text-ink-400" priority="hidden">
                      {row.installmentNo}
                    </Td>
                    <Td className="whitespace-nowrap text-xs" priority="primary">
                      {new Date(row.dueDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "2-digit",
                      })}
                    </Td>
                    <Td align="right" mono priority="normal">
                      {money(row.principalPart)}
                    </Td>
                    <Td align="right" mono className="text-warning-700" priority="normal">
                      {money(row.interestPart)}
                    </Td>
                    <Td align="right" mono className="font-semibold text-ink-900" priority="primary">
                      {money(row.amountDue)}
                    </Td>
                    <Td align="right" mono className="text-ink-500" priority="normal">
                      {money(row.closingBalance)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3">
      <p className="text-[11px] uppercase tracking-wider text-ink-400">{label}</p>
      <p className="tabular-nums mt-1 text-lg font-semibold text-ink-900">{value}</p>
    </div>
  );
}