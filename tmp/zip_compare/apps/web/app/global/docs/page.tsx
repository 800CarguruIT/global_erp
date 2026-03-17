import { AppLayout } from "@repo/ui";
import { listDocs } from "../../../lib/docs";
import { DocsIndexClient } from "./DocsIndexClient";

export const metadata = {
  title: "Global documentation",
  description: "Knowledge base for the Global ERP platform and services.",
};

export default async function GlobalDocsPage() {
  const docs = await listDocs();

  return (
    <AppLayout>
      <DocsIndexClient docs={docs} />
    </AppLayout>
  );
}
