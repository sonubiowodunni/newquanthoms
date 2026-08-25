==============================================================================
QWKBROWSER JS MD -- BACKEND JAVASCRIPT FILE INVENTORY
==============================================================================
Created: 2026-08-24
Location: docs/QWKBROWSER-JS.md
Purpose: Plain-English inventory of every backend .js file in this project.
         Each file gets a one-line description of what it does so that anyone
         (builder or agent) can review and modify with natural language.

MAINTENANCE RULE:
  Whenever a NEW .js file is created anywhere under backend/, the agent
  MUST add it to this document immediately. See AGENTS.md Rule 39.

  Whenever an existing .js file is REMOVED or RENAMED, update this document
  to reflect the change.

  The inventory should always match what is on disk. An out-of-date
  inventory is a bug, not a convenience.

==============================================================================
HOW TO USE THIS DOCUMENT
==============================================================================

  1. Find the file you want to understand by its path.
  2. Read the one-line description to know what it does.
  3. If you need to modify it, tell the agent in natural language what you
     want changed, referencing the file by name or path.
  4. The agent will read the actual file, make the change, and update
     this inventory if the file's purpose has changed.

==============================================================================
INVENTORY -- LAST UPDATED: 2026-08-24
==============================================================================

--- ROOT LEVEL (backend/) ---

1. backend/server.js
   Main entry point. Starts the Express server on port 3001, mounts all
   route files, applies middleware (CORS, CSRF, rate limiting, cookies),
   serves static frontend files, catches 404s.

2. backend/db.js
   The entire database layer. Creates all 72+ tables, runs schema migrations,
   seeds initial data (marketing accounts, admin account), and contains
   every CRUD function the routes call. The biggest file in the project.

3. backend/flags.js
   Feature flag switches for the backend. Each feature has a true/false
   toggle. Currently all non-core flags are false.

4. backend/x-oauth.js
   OAuth 1.0a flow for X (Twitter). Handles request tokens, access tokens,
   and signing requests.

5. backend/x-token-store.js
   Persists X (Twitter) OAuth tokens to the database so users don't have
   to re-authenticate.

6. backend/_check_schema.js
   Utility script to check database schema health. Not part of the running
   server.

--- BILLING (backend/billing/) ---

7. backend/billing/checkout.js
   Stripe checkout session creation. Handles buying QU and QC with real
   money.

8. backend/billing/stripe.js
   Stripe client initialization.

9. backend/billing/webhooks.js
   Stripe webhook handler. Processes payment confirmations, subscription
   updates, and refund events.

--- LIB (backend/lib/) ---

10. backend/lib/envValidator.js
    Validates environment variables on startup. Warns about missing/weak
    config in dev, refuses to boot in production if critical vars are
    missing.

--- MIDDLEWARE (backend/middleware/) ---

11. backend/middleware/cookieSign.js
    Signs and verifies cookies to prevent tampering.

12. backend/middleware/csrf.js
    CSRF protection. Generates and validates tokens for POST/PUT/DELETE
    requests.

13. backend/middleware/guestSession.js
    Manages guest sessions for unauthenticated users. Lets browsers
    explore without signing up.

14. backend/middleware/rateLimit.js
    Rate limiting. Prevents spam by limiting how many requests an IP can
    make per time window.

--- ROUTES (backend/routes/) ---

15. backend/routes/admin.js
    Admin-only endpoints. Checks admin permissions, handles admin actions
    like user management.

16. backend/routes/ads.js
    Ad banner system (QWK-030). Endpoints for eligible banners, clicking
    banners, dwell tracking, partner dashboard, banner CRUD. Currently
    flag-gated.

17. backend/routes/amplify.js
    URL amplification system. Users spend QU to boost URLs, visitors earn
    QU for visiting, milestone rewards.

18. backend/routes/appstore.js
    App store page data. Lists available apps, app details, install
    tracking.

19. backend/routes/auth.js
    Authentication. Register, login, guest login, claim guest account,
    logout, password reset, admin middleware, marketing account bypass
    logic.

20. backend/routes/billing.js
    Billing routes. Stripe checkout, webhooks, portal, subscription
    management, purchase history, currency hub.

21. backend/routes/bmf.js
    BMF QLUB system. Channels, feed, go live, record, collaborators,
    soundstage, subscriptions, members, comments.

22. backend/routes/business.js
    Business page system. Business profiles, business feed, business
    search.

23. backend/routes/calendar.js
    Calendar/scheduling. Event dates, reminders.

24. backend/routes/campaign.js
    URL promotion campaigns. Create, list, verify, draw winners.

25. backend/routes/clinic.js
    Clinic page. Health/wellness content or support tickets.

26. backend/routes/crowdfund.js
    Crowdfunding system. Create campaigns, contribute, track progress.

27. backend/routes/earn.js
    Quiz game. Questions, answers, stats, scoring, leaderboard data.

28. backend/routes/elist.js
    Email list. Subscribe, unsubscribe, list management.

29. backend/routes/factory.js
    Factory feed. The main social feed. Posts, reposts, comments, likes,
    raffle entries, content types, feed algorithm. The second biggest
    file.

30. backend/routes/indx.js
    Home page data. Stats, sources, dashboard info shown on the main
    page.

31. backend/routes/jobs.js
    Job board. Post jobs, apply, search, manage listings.

32. backend/routes/knowledgebase.js
    Knowledge base. Articles, categories, search.

33. backend/routes/leaderboard.js
    Quiz leaderboard. Rankings, top earners, top winners.

34. backend/routes/map.js
    Map page. Geographic data, user locations, map markers.

35. backend/routes/marketing-admin.js
    Marketing admin panel. Manage marketing accounts, view stats, control
    content.

36. backend/routes/messages.js
    Direct messages. Send, receive, list conversations, unread counts.

37. backend/routes/notes.js
    Notes system. Create, edit, delete, share, search notes.

38. backend/routes/notifications.js
    Notification system. Generate, list, mark read, clear.

39. backend/routes/partner-hub.js
    Partner hub. Advertising partner management, API keys, banner stats.

40. backend/routes/profile.js
    User profiles. 19 endpoints. Avatar, bio, settings, theme, badges,
    stats, followers, following.

41. backend/routes/programs.js
    Programs/campaigns. Scheduled content, automated posts.

42. backend/routes/promotional.js
    Promotional ads system. Ad slots, impressions, clicks.

43. backend/routes/quanthom.js
    Quanthom currency. Balance, transfer, history, ledger.

44. backend/routes/raffle.js
    Platform raffle. Daily draw, ticket purchase, winners, prize pool.

45. backend/routes/recommendations.js
    Shared URL recommendations. Suggests URLs to users based on activity.

46. backend/routes/referral.js
    Referral system. /r/:code redirect, attribution, social stats.

47. backend/routes/reminder.js
    Reminder system. Set, list, dismiss, snooze reminders.

48. backend/routes/retail.js
    Retail marketplace. Store profiles, items, transactions, cart,
    checkout, reviews. Third biggest file.

49. backend/routes/social-platforms.js
    Multi-platform OAuth stubs. Facebook, LinkedIn, Reddit, etc.

50. backend/routes/studio.js
    Studio page. Content creation tools, media upload.

51. backend/routes/supporters.js
    Supporters system. Follow, unfollow, supporter lists.

52. backend/routes/updates.js
    Version updates. Changelog, release notes.

53. backend/routes/url-tracking.js
    URL tracking analytics. Track URLs, folders, per-URL stats, category
    dashboard.

54. backend/routes/verification.js
    Verification system. Identity verification, badge system,
    verification requests.

55. backend/routes/voices.js
    Voices system. User posts/opinions, trending voices.

56. backend/routes/webcodes.js
    Webcode promotions. Create, list, verify, draw.

57. backend/routes/x.js
    X (Twitter) integration. Connect, share, stats, tweet.

--- SERVICES (backend/services/) ---

58. backend/services/referralService.js
    Referral service. Atomic ledger writes for referral rewards.

59. backend/services/trending-engine.js
    Trending computation engine. Calculates trending scores for voices
    and moodboards. Runs on a cycle.

==============================================================================
END OF BACKEND JS INVENTORY
==============================================================================
