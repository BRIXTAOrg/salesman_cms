export type RewardCurrency = "INR";

export type VoucherCampaignStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "revoked";

export type VoucherBatchStatus =
  | "generating"
  | "ready"
  | "partially_printed"
  | "printed"
  | "revoked";

export type VoucherStatus =
  | "available"
  | "claimed"
  | "expired"
  | "revoked";

export type VoucherClaimResult =
  | "claimed"
  | "already_claimed"
  | "expired"
  | "revoked"
  | "unavailable"
  | "invalid"
  | "request_conflict";

export type PayoutIntentStatus =
  | "created"
  | "processing"
  | "paid"
  | "failed"
  | "reversed";


export type RewardCampaignDefinition = {
  id: string;
  name: string;

  reward: {
    // Smallest currency unit.
    // ₹100.00 = 10000 paise.
    amountMinor: number;
    currency: RewardCurrency;
  };

  startsAt: string;
  expiresAt: string;

  status: VoucherCampaignStatus;
};


export type VoucherBatchDefinition = {
  id: string;
  campaignId: string;

  quantity: number;

  status: VoucherBatchStatus;

  createdAt: string;
};


export type VoucherClaimResponse = {
  result: VoucherClaimResult;

  idempotent?: boolean;

  voucherId?: string;
  claimId?: string;

  amountMinor?: number;
  currency?: RewardCurrency;

  claimedAt?: string;
};


export const QR_REWARDS_INVARIANTS = [
  "voucher_not_preassigned_to_user",
  "one_successful_claim_per_voucher",
  "atomic_claim",
  "server_authoritative_reward",
  "server_authoritative_expiry",
  "claim_before_payout",
  "idempotent_payout",
] as const;
