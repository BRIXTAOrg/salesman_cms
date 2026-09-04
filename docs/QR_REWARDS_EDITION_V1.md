# BRIXTA QR Rewards Edition V1

## Core model

A voucher is a bearer reward.

It is generated without a user.

The first authenticated user who successfully claims it
becomes its only claimant.

Example:

    USER A + QR 001 -> SUCCESS
    USER A + QR 001 -> ALREADY CLAIMED
    USER B + QR 001 -> ALREADY CLAIMED

    USER A + QR 002 -> SUCCESS

Therefore:

    USER -> MANY DIFFERENT VOUCHERS

but:

    VOUCHER -> MAXIMUM ONE SUCCESSFUL CLAIM


## CMS responsibility

The dashboard owns:

- reward campaigns
- reward value
- voucher quantity
- start time
- expiry
- batch generation
- QR printing
- claims dashboard
- payouts dashboard
- integration configuration
- sandbox testing


## Mobile responsibility

The application owns:

- open QR scanner
- scan QR
- submit captured token
- show authoritative result

The application does not determine:

- voucher amount
- expiry
- whether the voucher is unused
- whether it may be claimed
- payout status


## Backend responsibility

The backend owns:

- cryptographically secure voucher token generation
- token hashing
- persistence
- atomic claiming
- concurrency protection
- expiration
- revocation
- payout intents
- idempotency
- external API credentials
- external API execution
- webhook verification
- reconciliation


## Pixel Logic

Pixel orchestrates trusted services.

Target:

    QR SCANNED
         |
         v
    voucher.claim
         |
         +---- already claimed
         |
         +---- expired
         |
         +---- revoked
         |
         `---- CLAIMED
                  |
                  v
             payout.request
                  |
            processing / paid / failed

The one-time voucher guarantee is not an ordinary Pixel condition.

It is a backend/database invariant.


## Build order

1. Capability registry
2. Mobile QR scanner
3. Voucher persistence
4. Secure voucher generator
5. Atomic voucher claim
6. CMS Campaign + Batch Generator
7. Mass printing
8. Pixel platform-service execution
9. BRIXTA payout sandbox
10. REST integrations
11. webhook runtime
12. payout engine
13. Cashfree
