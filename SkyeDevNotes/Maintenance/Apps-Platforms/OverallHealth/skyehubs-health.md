# SkyeHubs Health

Path: Sky0s-Platforms/SkyeHubs/
Status: WARN
Gateway role: N/A

Inventory snapshot:
- Root SkyeHubs shared commerce shell
- Mobile Detailing branded variant
- NobleSoles branded variant

Current state:
- Booking and commerce flows are now documented as Stripe plus Neon/Postgres session-backed APIs
- This is a multi-variant commerce family, not a single static app

Known risks:
- Stripe env validation and end-to-end booking confirmation still need operational verification
- User-facing checkout failure states still need continuous validation
- Broader repo notes were stale here and required correction away from legacy cloud-stack wording

Next actions:
- Keep hub docs aligned with the Postgres/session model
- Verify Stripe secrets and webhook configuration per deployed variant
- Run full booking-flow verification across root, Mobile Detailing, and NobleSoles