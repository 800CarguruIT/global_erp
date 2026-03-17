import { redirect } from "next/navigation";

export default function GlobalIntegrationsRedirect() {
  redirect("/global/settings/integrations");
}
