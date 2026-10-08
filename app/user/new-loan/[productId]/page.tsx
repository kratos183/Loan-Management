import { notFound } from "next/navigation";
import { Portal, loadPortal } from "@/lib/portal";
import { getProduct, getRequirements, getActiveCoolingPeriod } from "@/lib/queries/applications";
import { ApplicationWizard } from "@/components/applications/application-wizard";

export const metadata = { title: "New Application" };

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const ctx = await loadPortal("user");

  const product = await getProduct(productId);
  if (!product || !product.is_active) notFound();

  const requirements = await getRequirements(product.id, product.collateral_type);
  const block = await getActiveCoolingPeriod(ctx.session.user.id, product.category);

  return (
    <Portal
      which="user"
      maxWidth="max-w-[1100px]"
      title={product.name}
      description={`${product.category === "SECURED" ? "Secured by" : "Unsecured, based on"} ${
        product.collateral_type === "NONE" ? "income and credit" : product.collateral_type.toLowerCase()
      }. ${product.description ?? ""}`}
    >
      <ApplicationWizard
        product={product}
        requirements={requirements}
        coolingPeriod={block}
      />
    </Portal>
  );
}