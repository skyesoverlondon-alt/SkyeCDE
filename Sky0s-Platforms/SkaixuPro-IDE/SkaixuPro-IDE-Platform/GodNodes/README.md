# GodNodes Variant Status

Canonical variant: `GodN0dePro2`

Why:
- Larger footprint than `G0dN0de2.4`
- Includes additional surfaces such as `GodNode2.html` and `BookOfGray_RoyalEdition.html`
- Appears to be the more feature-complete branch of the same concept

Legacy variant: `G0dN0de2.4`

Current handling:
- Keep in place for now as a legacy fallback while manual validation happens
- Do not build new links or integrations against it
- If no active dependency is found, move it to a dedicated `deprecated/` folder in a follow-up cleanup

Next manual check:
- Open both `index.html` files
- Confirm `GodN0dePro2` is the operator-facing version actually linked from launch surfaces
- If confirmed, archive `G0dN0de2.4`