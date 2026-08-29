# BANQ -- Commit Checkpoint Log

> Per AGENTS.md Rule 16: before any high-risk change (50%+ risk of breaking existing codebase),
> commit the current state and log it here so we can always roll back.

| Commit # | Date/Time | Latest Breakthrough Before Commit |
|----------|-----------|-----------------------------------|
| 5c3be7d | 2026-08-24 | Initial BANQ site build: 5 HTML pages (index, login, dashboard, billboards, about), server.js with API proxy to QWK:3001, CSS, JS helpers, placeholder content. |
| 195034c | 2026-08-25 | Replaced 4 qwkbrowser admin accounts with dedicated BANQ admin account (banqadmin) in PRE-DEPLOY.md. |
| 98b498c | 2026-08-25 | Independent auth system built: backend/auth.js + backend/db.js, banqadmin seeded, banq_token in localStorage. Separate from qwkbrowser. Server.js updated to mount local auth + proxy ads/profile only. |
