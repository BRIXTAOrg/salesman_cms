"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  Download,
  Loader2,
  Printer,
  QrCode,
  ShieldCheck,
} from "lucide-react";

import QRCode from "qrcode";


type CampaignRecord = {
  id: string;
  name: string;
  description?: string | null;
  rewardAmountMinor: number;
  currency: string;
  startsAt: string;
  expiresAt: string;
  status: string;
};


type PrintRecord = {
  voucherId: string;
  serialNumber: number;
  qrPayload: string;
};


type MintResult = {
  campaign: {
    id: string;
    name: string;
  };

  batch: {
    id: string;
    batchCode: string;
    quantity: number;
    rewardAmountMinor: number;
    expiresAt: string;
  };

  printRecords: PrintRecord[];

  warning?: string;
};


function inr(
  rupees: number,
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    },
  ).format(
    rupees,
  );
}


function csvCell(
  value: unknown,
) {
  const string =
    String(
      value ?? "",
    );

  return `"${string.replace(
    /"/g,
    '""',
  )}"`;
}



function QrImage({
  payload,
  size = 160,
}: {
  payload: string;
  size?: number;
}) {
  const [
    src,
    setSrc,
  ] = useState("");

  useEffect(() => {
    let active = true;

    QRCode.toDataURL(
      payload,
      {
        width: size,
        margin: 2,
        errorCorrectionLevel: "M",
      },
    )
      .then((url) => {
        if (active) {
          setSrc(url);
        }
      })
      .catch(() => {
        if (active) {
          setSrc("");
        }
      });

    return () => {
      active = false;
    };
  }, [
    payload,
    size,
  ]);

  if (!src) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border bg-background"
        style={{
          width: size,
          height: size,
        }}
      >
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="QR voucher"
      className="rounded-md bg-white"
    />
  );
}


function escapeHtml(
  value: unknown,
) {
  return String(
    value ?? "",
  )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


export function QrBatchBuilder() {
  const [
    campaigns,
    setCampaigns,
  ] = useState<CampaignRecord[]>(
    [],
  );

  const [
    selectedCampaignId,
    setSelectedCampaignId,
  ] = useState(
    "",
  );

  const [
    loadingCampaigns,
    setLoadingCampaigns,
  ] = useState(
    true,
  );

  const [
    quantity,
    setQuantity,
  ] = useState(
    5000,
  );

  const [
    minting,
    setMinting,
  ] = useState(
    false,
  );

  const [
    error,
    setError,
  ] = useState(
    "",
  );

  const [
    result,
    setResult,
  ] = useState<MintResult | null>(
    null,
  );


  const [
    printing,
    setPrinting,
  ] = useState(
    false,
  );


  const selectedCampaign =
    useMemo(
      () =>
        campaigns.find(
          (item) =>
            item.id ===
            selectedCampaignId,
        ) ?? null,
      [
        campaigns,
        selectedCampaignId,
      ],
    );


  useEffect(() => {
    let active = true;

    async function loadCampaigns() {
      setLoadingCampaigns(
        true,
      );

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

        const rows:
          CampaignRecord[] =
          body.campaigns ?? [];

        if (!active) {
          return;
        }

        setCampaigns(
          rows,
        );

        const usable =
          rows.find(
            (item) =>
              item.status ===
                "active" &&
              new Date(
                item.expiresAt,
              ).getTime() >
                Date.now(),
          );

        setSelectedCampaignId(
          (current) =>
            rows.some(
              (item) =>
                item.id ===
                current &&
                item.status ===
                  "active" &&
                new Date(
                  item.expiresAt,
                ).getTime() >
                  Date.now(),
            )
              ? current
              : usable?.id ?? "",
        );
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load campaigns.",
          );
        }
      } finally {
        if (active) {
          setLoadingCampaigns(
            false,
          );
        }
      }
    }

    void loadCampaigns();

    return () => {
      active = false;
    };
  }, []);


  const liability =
    useMemo(
      () =>
        (
          selectedCampaign
            ?.rewardAmountMinor ??
          0
        ) /
          100 *
        Math.max(
          0,
          quantity,
        ),
      [
        selectedCampaign,
        quantity,
      ],
    );


  async function mint() {
    if (minting) {
      return;
    }

    if (
      !selectedCampaignId
    ) {
      setError(
        "Select an active Campaign before creating a QR batch.",
      );
      return;
    }

    setMinting(true);
    setError("");
    setResult(null);

    try {
      const response =
        await fetch(
          "/api/qr-rewards/batches",
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify({
                campaignId:
                  selectedCampaignId,

                quantity,
              }),
          },
        );

      const body =
        await response.json();

      if (!response.ok) {
        throw new Error(
          body?.error ||
            "Batch generation failed.",
        );
      }

      setResult(
        body as MintResult,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Batch generation failed.",
      );
    } finally {
      setMinting(false);
    }
  }


  function downloadManifest() {
    if (!result) {
      return;
    }

    const rows = [
      [
        "batch_code",
        "voucher_id",
        "serial_number",
        "qr_payload",
      ],

      ...result.printRecords.map(
        (record) => [
          result.batch.batchCode,
          record.voucherId,
          record.serialNumber,
          record.qrPayload,
        ],
      ),
    ];

    const csv =
      rows
        .map(
          (row) =>
            row
              .map(csvCell)
              .join(","),
        )
        .join("\\n");

    const blob =
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8",
        },
      );

    const url =
      URL.createObjectURL(
        blob,
      );

    const anchor =
      document.createElement(
        "a",
      );

    anchor.href =
      url;

    anchor.download =
      `${result.batch.batchCode}-voucher-manifest.csv`;

    document.body.appendChild(
      anchor,
    );

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(
      url,
    );
  }



  async function printQrBatch() {
    if (
      !result ||
      printing
    ) {
      return;
    }

    const popup =
      window.open(
        "",
        "_blank",
      );

    if (!popup) {
      setError(
        "Browser blocked the print window. Allow popups and try again.",
      );
      return;
    }

    setPrinting(true);
    setError("");

    try {
      popup.document.open();
      popup.document.write(`
        <!doctype html>
        <html>
          <head>
            <title>${escapeHtml(
              result.batch.batchCode,
            )} QR Labels</title>

            <style>
              @page {
                size: A4;
                margin: 8mm;
              }

              * {
                box-sizing: border-box;
              }

              body {
                margin: 0;
                font-family:
                  -apple-system,
                  BlinkMacSystemFont,
                  "Segoe UI",
                  sans-serif;
                color: #111;
                background: white;
              }

              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                gap: 16px;
                padding-bottom: 8mm;
              }

              .header h1 {
                margin: 0;
                font-size: 18px;
              }

              .header p {
                margin: 4px 0 0;
                color: #555;
                font-size: 11px;
              }

              .sheet {
                display: grid;
                grid-template-columns:
                  repeat(4, 1fr);
                gap: 4mm;
              }

              .label {
                border: 1px dashed #bbb;
                border-radius: 3mm;
                min-height: 42mm;
                padding: 3mm;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                break-inside: avoid;
                page-break-inside: avoid;
              }

              .label img {
                width: 29mm;
                height: 29mm;
                object-fit: contain;
              }

              .serial {
                margin-top: 2mm;
                font-size: 9px;
                font-weight: 700;
              }

              .batch {
                margin-top: 1mm;
                font-size: 7px;
                color: #666;
              }

              .reward {
                margin-top: 1mm;
                font-size: 8px;
                font-weight: 600;
              }

              @media print {
                .header {
                  display: none;
                }
              }
            </style>
          </head>

          <body>
            <div class="header">
              <div>
                <h1>QR Voucher Labels</h1>
                <p>
                  ${escapeHtml(
                    result.campaign.name,
                  )}
                  ·
                  ${escapeHtml(
                    result.batch.batchCode,
                  )}
                </p>
              </div>

              <p>
                ${result.printRecords.length.toLocaleString(
                  "en-IN",
                )} vouchers
              </p>
            </div>

            <div
              id="sheet"
              class="sheet"
            ></div>
          </body>
        </html>
      `);

      popup.document.close();

      const sheet =
        popup.document.getElementById(
          "sheet",
        );

      if (!sheet) {
        throw new Error(
          "Print sheet could not be created.",
        );
      }

      const chunkSize =
        100;

      for (
        let start = 0;
        start <
        result.printRecords.length;
        start += chunkSize
      ) {
        const chunk =
          result.printRecords.slice(
            start,
            start + chunkSize,
          );

        const generated =
          await Promise.all(
            chunk.map(
              async (
                record,
              ) => ({
                record,
                src:
                  await QRCode.toDataURL(
                    record.qrPayload,
                    {
                      width:
                        220,
                      margin:
                        2,
                      errorCorrectionLevel:
                        "M",
                    },
                  ),
              }),
            ),
          );

        for (
          const {
            record,
            src,
          } of generated
        ) {
          const label =
            popup.document.createElement(
              "div",
            );

          label.className =
            "label";

          label.innerHTML = `
            <img
              src="${src}"
              alt="QR ${escapeHtml(
                record.serialNumber,
              )}"
            />

            <div class="serial">
              QR #${escapeHtml(
                record.serialNumber,
              )}
            </div>

            <div class="reward">
              ₹${(
                result.batch.rewardAmountMinor /
                100
              ).toLocaleString(
                "en-IN",
              )}
            </div>

            <div class="batch">
              ${escapeHtml(
                result.batch.batchCode,
              )}
            </div>
          `;

          sheet.appendChild(
            label,
          );
        }

        await new Promise<void>(
          (resolve) =>
            setTimeout(
              resolve,
              0,
            ),
        );
      }

      await new Promise<void>(
        (resolve) =>
          setTimeout(
            resolve,
            300,
          ),
      );

      popup.focus();
      popup.print();
    } catch (cause) {
      popup.close();

      setError(
        cause instanceof Error
          ? cause.message
          : "Could not build QR print sheet.",
      );
    } finally {
      setPrinting(false);
    }
  }


  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-2xl border bg-card">
        <div className="border-b p-5">
          <h2 className="font-semibold">
            Mint QR voucher batch
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            This now creates real persistent voucher records.
          </p>
        </div>

        <div className="grid gap-5 p-5">
          <Field
            label="Campaign"
            hint="Every QR batch belongs to an existing reward Campaign."
          >
            <select
              value={
                selectedCampaignId
              }
              disabled={
                loadingCampaigns
              }
              onChange={
                (event) =>
                  setSelectedCampaignId(
                    event.target.value,
                  )
              }
              className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none disabled:opacity-60"
            >
              <option value="">
                {
                  loadingCampaigns
                    ? "Loading campaigns..."
                    : "Select a campaign"
                }
              </option>

              {campaigns
                .filter(
                  (item) =>
                    item.status ===
                      "active" &&
                    new Date(
                      item.expiresAt,
                    ).getTime() >
                      Date.now(),
                )
                .map(
                  (item) => (
                    <option
                      key={
                        item.id
                      }
                      value={
                        item.id
                      }
                    >
                      {
                        item.name
                      }
                    </option>
                  ),
                )}
            </select>

            {!loadingCampaigns &&
              campaigns.length ===
                0 && (
                <div className="text-xs text-muted-foreground">
                  No Campaign exists yet. Create one from the Campaigns tab first.
                </div>
              )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Reward per QR"
              hint="Inherited from the selected Campaign."
            >
              <div className="flex h-10 items-center rounded-xl border bg-muted/20 px-3 text-sm font-medium">
                {
                  selectedCampaign
                    ? inr(
                        selectedCampaign.rewardAmountMinor /
                          100,
                      )
                    : "—"
                }
              </div>
            </Field>

            <Field
              label="Unique QRs"
              hint="Maximum 10,000 per batch for V1."
            >
              <input
                type="number"
                min={1}
                max={10000}
                value={
                  quantity
                }
                onChange={
                  (event) =>
                    setQuantity(
                      Number(
                        event.target.value,
                      ),
                    )
                }
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none"
              />
            </Field>
          </div>

          <Field
            label="Campaign expiry"
            hint="Every batch minted here inherits the Campaign expiry."
          >
            <div className="flex h-10 items-center rounded-xl border bg-muted/20 px-3 text-sm font-medium">
              {
                selectedCampaign
                  ? new Date(
                      selectedCampaign.expiresAt,
                    ).toLocaleString(
                      "en-IN",
                    )
                  : "—"
              }
            </div>
          </Field>

          <div className="rounded-xl border bg-muted/25 p-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />

              <div>
                <div className="text-sm font-medium">
                  One QR = one successful claimant
                </div>

                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  These vouchers have no owner when minted.
                  Claim ownership is assigned later by the
                  atomic redemption service.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={
              minting ||
              !selectedCampaignId
            }
            onClick={
              () =>
                void mint()
            }
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-50"
          >
            {minting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Minting {quantity.toLocaleString("en-IN")} vouchers...
              </>
            ) : (
              <>
                <QrCode className="h-4 w-4" />
                Mint real QR batch
              </>
            )}
          </button>
        </div>
      </section>


      <div className="grid content-start gap-4">
        <section className="rounded-2xl border bg-card p-5">
          <div className="text-sm font-medium text-muted-foreground">
            Maximum reward exposure
          </div>

          <div className="mt-2 text-3xl font-semibold">
            {inr(
              liability,
            )}
          </div>

          <div className="mt-1 text-xs text-muted-foreground">
            {quantity.toLocaleString(
              "en-IN",
            )}
            {" × "}
            {
              selectedCampaign
                ? inr(
                    selectedCampaign.rewardAmountMinor /
                      100,
                  )
                : "—"
            }
          </div>
        </section>


        {result && (
          <>
            <section className="rounded-2xl border bg-card p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Batch minted
              </div>

              <div className="mt-2 text-xl font-semibold">
                {
                  result.batch.batchCode
                }
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Metric
                  label="Vouchers"
                  value={
                    result.printRecords.length.toLocaleString(
                      "en-IN",
                    )
                  }
                />

                <Metric
                  label="Reward"
                  value={
                    inr(
                      result.batch.rewardAmountMinor /
                        100,
                    )
                  }
                />
              </div>
            </section>


            <section className="rounded-2xl border bg-card p-5">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

                <div>
                  <div className="font-medium">
                    Bearer secrets
                  </div>

                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    The database stores only hashes.
                    This generated manifest contains the
                    actual redeemable QR payloads.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  downloadManifest
                }
                className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium hover:bg-muted"
              >
                <Download className="h-4 w-4" />

                Download voucher manifest CSV
              </button>

              <button
                type="button"
                disabled={printing}
                onClick={
                  () =>
                    void printQrBatch()
                }
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
              >
                {printing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Building QR sheet...
                  </>
                ) : (
                  <>
                    <Printer className="h-4 w-4" />
                    Print entire QR batch
                  </>
                )}
              </button>
            </section>


            <section className="rounded-2xl border bg-card p-5">
              <div className="text-sm font-medium">
                Sample generated records
              </div>

              <div className="mt-4 grid gap-2">
                {result.printRecords
                  .slice(
                    0,
                    5,
                  )
                  .map(
                    (record) => (
                      <div
                        key={
                          record.voucherId
                        }
                        className="rounded-lg bg-muted/40 p-3"
                      >
                        <div className="flex items-center gap-4">
                          <QrImage
                            payload={
                              record.qrPayload
                            }
                            size={
                              110
                            }
                          />

                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold">
                              QR #
                              {
                                record.serialNumber
                              }
                            </div>

                            <div className="mt-1 text-xs text-muted-foreground">
                              {
                                inr(
                                  result.batch.rewardAmountMinor /
                                    100,
                                )
                              }
                            </div>

                            <div className="mt-2 truncate font-mono text-[10px] text-muted-foreground">
                              {
                                record.qrPayload
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}


function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <div>
        <div className="text-sm font-medium">
          {label}
        </div>

        <div className="mt-0.5 text-xs text-muted-foreground">
          {hint}
        </div>
      </div>

      {children}
    </label>
  );
}


function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="text-xs text-muted-foreground">
        {label}
      </div>

      <div className="mt-1 font-semibold">
        {value}
      </div>
    </div>
  );
}
