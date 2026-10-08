import { Info, Landmark } from "lucide-react";
import { Portal } from "@/lib/portal";
import { EmiCalculator } from "@/components/loan/emi-calculator";

export const metadata = { title: "EMI Calculator" };

export default function EmiCalculatorPage() {
  return (
    <Portal
      which="user"
      title="EMI Calculator"
      description="Work out your instalment, total interest and amortisation schedule before you apply."
      maxWidth="max-w-[1200px]"
    >
      <EmiCalculator />
    </Portal>
  );
}