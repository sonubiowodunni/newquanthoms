# BANQ -- Commit Checkpoint Log

> Per AGENTS.md Rule 16: before any high-risk change (50%+ risk of breaking existing codebase),
> commit the current state and log it here so we can always roll back.

| Commit # | Date/Time | Latest Breakthrough Before Commit |
|----------|-----------|-----------------------------------|
| 5c3be7d | 2026-08-24 | Initial BANQ site build: 5 HTML pages (index, login, dashboard, billboards, about), server.js with API proxy to QWK:3001, CSS, JS helpers, placeholder content. |
| 195034c | 2026-08-25 | Replaced 4 qwkbrowser admin accounts with dedicated BANQ admin account (banqadmin) in PRE-DEPLOY.md. |
| 98b498c | 2026-08-25 | Independent auth system built: backend/auth.js + backend/db.js, banqadmin seeded, banq_token in localStorage. Separate from qwkbrowser. Server.js updated to mount local auth + proxy ads/profile only. |
| db854a4 | 2026-09-21 | BANQ-021 BANQ standalone half: js/ad-catalog.js (single source of truth) + js/ad-page.js (full page + partial popup renderers), packages.html and the index.html popup rebuilt as render targets, dashboard deep link resolved through the catalog, /api/ad-profile proxy, verify script 18 PASS. |
| 67c3716 | 2026-09-21 | Contact form stops claiming success and discarding messages; phantom seed-script claim corrected in NEEDED BACKEND section 4; docs/BANQ-REMAINING-WORK.md added. |
| d9c41aa | 2026-09-21 | Intelligence scope reconciled to one build authority (implementation plan, 37 steps); system doc no longer carries a count; pipeline gained BANQ-022; repo AGENTS.md gained wing rules WR-1 and WR-2. |

## Session log (most recent first)

| Date | Change | Risk before | Rollback point |
|---|---|---|---|
| 2026-09-21 | Contact backend (backend/banq.js) + contact_messages / contact_notifications tables + admin-console.html. Verified live 8/8. | Medium -- new tables and a new route namespace, additive only | d9c41aa |
