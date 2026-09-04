"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";


type Campaign = {
  id: string;
  name: string;
  description?: string | null;
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
  ] = useState<Campaign[]>(
    [],
  );

  const [
    error,
    setError,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    creating,
    setCreating,
  ] = useState(false);

  const [
    name,
    setName,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    reward,
    setReward,
  ] = useState(100);

  const [
    validityDays,
    setValidityDays,
  ] = useState(30);


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


  async function createCampaign(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (creating) {
      return;
    }

    setCreating(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/qr-rewards/campaigns",
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify({
                name:
                  name.trim(),

                description:
                  description.trim() ||
                  null,

                rewardAmountMinor:
                  Math.round(
                    reward *
                      100,
                  ),

                validityDays,
              }),
          },
        );

      const body =
        await response.json();

      if (!response.ok) {
        throw new Error(
          body?.error ||
            "Could not create Campaign.",
        );
      }

      setName("");
      setDescription("");
      setReward(100);
      setValidityDays(30);

      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create Campaign.",
      );
    } finally {
      setCreating(false);
    }
  }


  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border bg-card">
        <div className="border-b p-5">
          <h2 className="font-semibold">
            Create Campaign
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Define the reward programme once. Multiple QR batches can then be minted inside this Campaign.
          </p>
        </div>

        <form
          onSubmit={
            createCampaign
          }
          className="grid gap-4 p-5"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium">
                Campaign name
              </span>

              <input
                required
                value={
                  name
                }
                onChange={
                  (event) =>
                    setName(
                      event.target.value,
                    )
                }
                placeholder="Mason Rewards 2026"
                className="h-10 rounded-xl border bg-background px-3 text-sm outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium">
                Reward per QR
              </span>

              <div className="flex h-10 items-center rounded-xl border">
                <span className="px-3 text-sm text-muted-foreground">
                  ₹
                </span>

                <input
                  required
                  type="number"
                  min={1}
                  value={
                    reward
                  }
                  onChange={
                    (event) =>
                      setReward(
                        Number(
                          event.target.value,
                        ),
                      )
                  }
                  className="h-full min-w-0 flex-1 bg-transparent pr-3 text-sm outline-none"
                />
              </div>
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium">
              Description
            </span>

            <textarea
              value={
                description
              }
              onChange={
                (event) =>
                  setDescription(
                    event.target.value,
                  )
              }
              placeholder="Reward programme for masons..."
              className="min-h-24 rounded-xl border bg-background p-3 text-sm outline-none"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">
              Campaign validity
            </span>

            <div className="flex h-10 items-center rounded-xl border">
              <input
                required
                type="number"
                min={1}
                max={3650}
                value={
                  validityDays
                }
                onChange={
                  (event) =>
                    setValidityDays(
                      Number(
                        event.target.value,
                      ),
                    )
                }
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
              />

              <span className="pr-3 text-sm text-muted-foreground">
                days
              </span>
            </div>
          </label>

          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              creating
            }
            className="h-10 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
          >
            {
              creating
                ? "Creating Campaign..."
                : "Create Campaign"
            }
          </button>
        </form>
      </section>


      <section>
        <div className="mb-3">
          <h2 className="font-semibold">
            Existing Campaigns
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Generate as many independent QR batches as required under any active Campaign.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">
            Loading campaigns...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">
            No Campaigns yet. Create the first Campaign above.
          </div>
        ) : (
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
                (
                  campaign,
                ) => (
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

                      {campaign.description && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {
                            campaign.description
                          }
                        </div>
                      )}

                      <div className="mt-1 font-mono text-[10px] text-muted-foreground">
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
        )}
      </section>
    </div>
  );
}
