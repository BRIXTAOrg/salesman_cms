import EntitiesClient from "@/components/appliance/entities-client";

// BRIXTA_CLEAN_UI_V1 — imports and lists get their own page instead of
// living inside the Responsibilities studio.
export default function ListsPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 md:p-6">
      <EntitiesClient standalone />
    </div>
  );
}
