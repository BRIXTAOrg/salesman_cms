"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";


type Campaign = {
  id: string;
  name: string;
  rewardAmountMinor: number;
  currency: string;
  startsAt: string;
  expiresAt: string;
  status: string;
  createdAt: string;
};


function money(
  amountMinor: number,
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
    },
  ).format(
    Number(
      amountMinor,
    ) / 100,
  );
}


export function CampaignRecords() {
  const [
    campaigns,
    setCampaigns,
  ] = useState<Campaign[]>([]);

  const [
    error,
    setError,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const response =
            await fetch(
              "/api/qr-rewards/campaigns",
              {
                cache:
                  "no-store",
              },
            );

          const body =
            await response.json();

          if (!response.ok) {
            throw new Error(
              body?.error ||
                "Could not load campaigns.",
            );
          }

          setCampaigns(
            body.campaigns ?? [],
          );
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load campaigns.",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">
        Loading campaigns...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border bg-card p-6">
        <div className="font-medium">
          QR Records are not ready
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          {error}
        </p>

        <p className="mt-3 font-mono text-xs text-muted-foreground">
          npm run qr-rewards:provision
        </p>
      </div>
    );
  }

  if (!campaigns.length) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">
        No campaigns yet. Generate your first QR batch.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="grid grid-cols-5 gap-4 border-b bg-muted/30 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <div className="col-span-2">
          Campaign
        </div>

        <div>
          Reward
        </div>

        <div>
          Expiry
        </div>

        <div>
          Status
        </div>
      </div>

      <div className="divide-y">
        {campaigns.map(
          (campaign) => (
            <div
              key={
                campaign.id
              }
              className="grid grid-cols-5 gap-4 px-5 py-4 text-sm"
            >
              <div className="col-span-2">
                <div className="font-medium">
                  {
                    campaign.name
                  }
                </div>

                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {
                    campaign.id
                  }
                </div>
              </div>

              <div className="font-medium">
                {money(
                  campaign.rewardAmountMinor,
                )}
              </div>

              <div className="text-muted-foreground">
                {new Date(
                  campaign.expiresAt,
                ).toLocaleDateString(
                  "en-IN",
                )}
              </div>

              <div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                  {
                    campaign.status
                  }
                </span>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
