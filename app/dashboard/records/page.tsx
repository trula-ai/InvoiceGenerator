import type { Metadata } from "next";

import { RecordsCard } from "@/components/dashboard/records-card";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { getRecordsOverview } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Records" };

export default async function RecordsPage() {
  const { business } = await requireUser();
  const records = await getRecordsOverview(business.id);

  return (
    <>
      <PageHeader title="Records" description="Every client, invoice and payment in your workspace." />
      <RecordsCard records={records} />
    </>
  );
}
