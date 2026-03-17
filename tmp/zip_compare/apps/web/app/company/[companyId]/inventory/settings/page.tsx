import { AppLayout } from "@repo/ui";
import InventorySettingsClient from "./settingsClient";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default async function InventorySettingsPage({ params }: Params) {
  const resolved = params instanceof Promise ? await params : params;
  return (
    <AppLayout forceScope={{ scope: "company", companyId: resolved.companyId }}>
      <InventorySettingsClient companyId={resolved.companyId} />
    </AppLayout>
  );
}
