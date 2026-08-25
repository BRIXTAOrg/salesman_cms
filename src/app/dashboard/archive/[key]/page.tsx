import ArchivedResponsibilityClient from "@/components/appliance/archived-responsibility-client";

export default async function ArchivedResponsibilityPage({
  params,
}: {
  params: Promise<{
    key: string;
  }>;
}) {
  const { key } = await params;

  return <ArchivedResponsibilityClient responsibilityKey={key} />;
}
