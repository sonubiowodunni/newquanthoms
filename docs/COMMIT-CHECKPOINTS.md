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
| _(uncommitted)_ | 2026-09-22 | BANQ-022 Intelligence System complete (37 steps across backend/intelligence/ + banq-intelligence.js + billboards.js + flags.js + js/monitor.js + monitor.html) and BANQ-023 the $15/month monitoring gate. 129 PASS / 0 FAIL. Also fixed a real server bug: PORT was not coerced, so a string port made app.listen() take the named-pipe branch and the server logged "running" while answering nothing. |

## Session log (most recent first)

| Date | Change | Risk before | Rollback point |
|---|---|---|---|
| 2026-09-22 | **BANQ-024 identity bridge + BANQ-025 partner proxy correctness + BANQ-020 verification suites + G6 responsive fixes.** Touches auth (a core file, Rule 16): `users` gains 4 columns via `ensureColumn`, login gains a bridge fallback, and `server.js` middleware ORDER changes (the proxy now registers before `express.json()`). Also `js/app.js` gains `qwkFetch`, which is what stops a QwkBrowser 401 from signing a BANQ user out. Verified: 4 suites, **257 PASS / 0 FAIL** total, plus a live browser sign-in with a real QwkBrowser account and a live phone-width layout probe on 6 pages. | HIGH -- auth semantics + middleware order + a shared secret that must match qwkbrowser/backend/.env | `data/banq.db` holds no migration risk (columns are additive with defaults), so the rollback point is the last commit; re-run `node scripts/verify-all.ps1` after any rollback |
| 2026-09-22 | Two proxy defects fixed in `server.js` (prefix stripping under http-proxy-middleware v3, and `express.json()` registered before the proxy so POSTs hung). Both were live on 3002 while every log said 200 OK. Found by probing the BODY of `/api/ads/public`, not its status. | HIGH -- the whole partner API surface | this row |
| 2026-09-22 | **Pre-change checkpoint for the intelligence build (Rule 16).** Database backed up to `data/banq.db.backup-20260922` BEFORE the first schema statement ran, because Pre-Step 0.3 adds 51 tables to a database that previously had 2. The backup is the rollback point for the whole session's DB work. | HIGH -- 51 new tables against a live database, plus a UNIQUE index created after a dedupe pass | `data/banq.db.backup-20260922` |
| 2026-09-22 | Intelligence schema (51 tables) + banq_config seed (32 keys) + `backend/intelligence/` engines + `/api/banq/*` routes + billboards + flags + monitor page. Verified 129 PASS, re-run twice with identical results. | HIGH | see the DB backup above |
| 2026-09-22 | Post-change checkpoint: the schema change is proven additive and idempotent (migrate() runs on every boot and a second run changes nothing). Recommend committing here as the rollback point for the NEXT high-risk change. | -- | this row |
| 2026-09-21 | Contact backend (backend/banq.js) + contact_messages / contact_notifications tables + admin-console.html. Verified live 8/8. | Medium -- new tables and a new route namespace, additive only | d9c41aa |

## Bugs found and fixed during the 2026-09-22 build (each one was a real wrong answer, not a style issue)

| # | Bug | What it produced | Fix |
|---|---|---|---|
| 1 | Creative score used efficiency RATES only | A creative losing 55% of its delivery per day scored **95 STRONG** | A sustained volume decline overrules the band and carries its reason |
| 2 | Trend compared raw sums across unequal windows | A **falling** metric reported as **+22% rising** | Per-day rate, and a window with no rows reports null instead of zero |
| 3 | Fatigue streak reset when a period had no earlier data | Fatigue undetectable on exactly the young creatives most exposed to it | A period with no earlier window is skipped, not treated as a break |
| 4 | `journey_event_sources` had no unique name, so `INSERT OR IGNORE` duplicated it every run | A 42,000-impression funnel read as **126,000** | UNIQUE index after a dedupe pass; the seed now registers sources through the engine |
| 5 | INSUFFICIENT_DATA stored a score row of **0** | A creative with no data read as a real score of zero in history and in averages | Nothing is written when there is nothing to score |
| 6 | `PORT` from the environment was not coerced | `app.listen("0")` took the named-pipe branch: the server logged "running on http://localhost:0" and answered nothing | `Number(process.env.PORT) \|\| 3002` |

## Bugs found and fixed on 2026-09-22 (identity + proxy session)

| # | Bug | What it produced | Fix |
|---|---|---|---|
| 1 | Login only ever compared against BANQ's own `users` table | The site's own copy promised "sign in with your QwkBrowser account" and rejected every real one with "Invalid credentials" -- the founder's own account included | `backend/qwk-identity.js`: signed handoff + server-to-server credential check; QwkBrowser is the authority, BANQ keeps its own sessions |
| 2 | `BANQ.qwkFetch` was an alias of `fetchJson`, which clears the session on ANY 401 | A QwkBrowser 401 on a banner click signed the person OUT of BANQ. From the outside: "the login doesn't work" | `qwkFetch` never clears a BANQ session; it reports the real reason |
| 3 | Proxy mounted at a path (hpm v3 strips it) + `pathRewrite` re-adding a prefix that was gone | `/api/ads/public` reached QwkBrowser as `/public?limit=1`; its SPA fallback answered with ITS HOMEPAGE and a 200. The feed had never received a banner -- it received a web page and fell back to mocks | one `pathFilter` proxy; full path forwarded unchanged |
| 4 | `express.json()` registered BEFORE the proxy | The parser consumed the body; the proxy forwarded Content-Length with no body and the upstream waited forever. Every GET worked, every POST hung, nothing logged | proxy registers first |
| 5 | SPA fallback caught unknown `/api/*` paths | A retired or misspelled endpoint answered with index.html and a 200 -- a success status and a failure body | `/api/*` answers JSON 404 |
| 6 | Throttled identity checks surfaced as "unreachable" | A live verification run exhausted the shared login limiter; every later check reported an outage, sending an operator to look at a service that was running fine | a dedicated `partnerVerifyLimiter`, and a distinct `rate_limited` / `identity_error` / `identity_unreachable` mapping |
| 7 | `BANQ_SSO_SECRET` was written to an `.env` nothing read (and the QWK value sat in the repo-root `.env` while the server loads `backend/.env`) | The bridge would have 503'd forever with no visible cause | a dependency-free `.env` loader, the secret in the file the server actually reads, and a startup line that states whether QwkBrowser sign-in is enabled |
| 8 | The header never wrapped | Every page scrolled sideways at phone width (document 728px on a 373px viewport); the nav was only hidden at <=375px, leaving the whole 376-480 band -- most phones -- without phone rules | a `<=480px` tier per BANQ-RB-001, placed before the 375px block so the tighter rule still wins |
| 10 | Page-specific phone rules were written into `css/styles.css` for classes owned by a page's own `<style>` block | The linked stylesheet is applied BEFORE the inline block, so at equal specificity the inline rule wins: the monitor's stat value still rendered 22px at a 390px viewport, and the funnel row still had four columns, with the "fix" present and doing nothing. Found by MEASURING the computed style instead of trusting that the CSS had been added | those rules moved into `monitor.html`'s own block, after its 768px rules. Verified: stat value 18px, label 9px, funnel row a single 373px track |
| 9 | A verify script called `process.exit()` while undici was still closing a keep-alive socket | The suite printed **55 PASS / 0 FAIL** and then the process ABORTED on a libuv assertion (`!(handle->flags & UV_HANDLE_CLOSING)`), so `verify-all.ps1` reported `FAIL -1073740791` for a run with zero failures. A green suite read as a crash | `process.exitCode` instead of `process.exit()`, letting the event loop drain. Worth recording because the runner was RIGHT to distrust it: any monitor that trusted the printed summary over the exit code would have shipped this |
