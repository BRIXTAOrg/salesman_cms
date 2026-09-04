import Link from "next/link";

const links = [
  {
    href: "/dashboard/qr-rewards",
    label: "Overview",
  },
  {
    href: "/dashboard/qr-rewards/campaigns",
    label: "Campaigns",
  },
  {
    href: "/dashboard/qr-rewards/batches",
    label: "QR Records",
  },
  {
    href: "/dashboard/qr-rewards/claims",
    label: "Claims",
  },
  {
    href: "/dashboard/qr-rewards/generate",
    label: "Generate & Print",
  },
  {
    href: "/dashboard/qr-rewards/integration-lab",
    label: "Integration Lab",
  },
];

export function QrRewardsHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-b bg-background">
      <div className="mx-auto w-full max-w-7xl px-6 py-6">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            BRIXTA QR Rewards
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">
            {title}
          </h1>

          <p className="max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        </div>

        <nav className="mt-6 flex flex-wrap gap-2">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
