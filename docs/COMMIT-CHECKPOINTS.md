# QwkBrowser -- Commit Checkpoint Log

> Per AGENTS.md Rule 21: before any high-risk change (50%+ risk of breaking existing codebase),
> commit the current state and log it here so we can always roll back.

| Commit # | Date/Time | Latest Breakthrough Before Commit |
|----------|-----------|-----------------------------------|
| 0d86e89 | 2026-08-15 16:22 UTC+2 | Factory filter chips added (GIFs, Story, Emojis, Certificates, Reels). QWK Provenance, Master Pipeline, Stationhead specs written. AGENTS.md Rules 20-21 added. Stable state before retail.html cart + image banner rework.
| 24d7a6f | 2026-08-15 10:37 UTC-7 | Retail cart remove toggle moved to front of each item (all 3 cart renderers). Product image banner added to retail.html product cards + factory.html feed posts. Backend /api/retail/items returns first_image_url. /board/items requires multipart image upload. retail-board.html form uses FormData. Verification scripts v49/v50/v71 updated with new checks. |
