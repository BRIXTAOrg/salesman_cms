import DynamicWorkClient from "@/components/appliance/dynamic-work-client";

export default async function DynamicWorkPage({
  params,
}: {
  params: Promise<{
    key: string;
  }>;
}) {
  const { key } = await params;

  return (
    <DynamicWorkClient
      responsibilityKey={key}
    />
  );
}
