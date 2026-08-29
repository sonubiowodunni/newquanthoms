# NEEDED BACKEND FOR BANQ WEBSITE

## Overview
This document tracks backend work that is deferred or not yet implemented for the New Quanthoms Billboard Agency (BANQ) website at www.newquanthoms.com.

The BANQ site runs on port 3002 and proxies API requests to the QwkBrowser backend on port 3001. Most API routes already exist in `backend/routes/ads.js`. The items below need new endpoints or backend logic.

---

## 1. Billboard Declaration Endpoint

**Status:** DEFERRED

**What it does:** When a user submits the billboard declaration form on `billboards.html`, the data should be stored in the database so that:
- Billboard demand can be aggregated by city (powers the Billboard Interest sidebar)
- Admin can see which locations users are requesting
- Demand stats table on billboards.html shows real data instead of mock data

**Current state:**
- `billboards.html` has the declaration form (city, country, billboard type, message)
- `billboards.html` has a mock demand stats table with placeholder data
- No backend endpoint exists to accept declarations

**Needed:**
- `POST /api/billboards/declare` -- accepts: `{ city, country, billboard_type, message }`
- Store in new table `billboard_declarations` (id, user_id, city, country, billboard_type, message, created_at)
- `GET /api/billboards/interest` -- returns top cities by declaration count in last 7 days
- `GET /api/billboards/demand` -- returns all declarations for admin/stats table
- Auth required (user must be signed in)

**Impact:** Without this, the Billboard Interest sidebar uses placeholder data and the demand stats table is static.

---

## 2. Contact Form Backend

**Status:** DEFERRED

**What it does:** When a user fills out the contact form on `about.html`, the message should be stored or emailed to the New Quanthoms team.

**Current state:**
- `about.html` has the contact form (name, email, subject, message)
- Form submission is handled client-side only (shows success toast but does not send data)
- No backend endpoint exists to accept contact submissions

**Needed:**
- `POST /api/contact` -- accepts: `{ name, email, subject, message }`
- Store in new table `contact_messages` (id, name, email, subject, message, created_at, status)
- OR send via email service (SendGrid, Nodemailer, etc.)
- Rate limiting (max 1 per 30 seconds per IP)
- No auth required (public form)

**Impact:** Without this, contact form submissions are lost. Users see a success message but nothing is actually sent.

---

## 3. QAP Integration (Quanthom Advertising Profile)

**Status:** PARTIALLY DONE (frontend only)

**What it does:** Users with a QAP number (issued on QwkBrowser `mybmf.html`) can plug it into the AD-Packages popup on `index.html` or into `packages.html` to launch ad campaigns.

**Current state:**
- Frontend UI exists: AD-Packages popup on index.html, QAP input on packages.html, QAP banner on dashboard.html
- QAP format validated client-side (`QAP-[A-Z0-9]{6,}`)
- Redirect to dashboard with `?qap=QAP-XXXX&pkg=starter` query params works
- No backend validation of QAP numbers exists
- No backend endpoint to link a QAP number to a banner campaign

**Needed:**
- `POST /api/ads/launch-with-qap` -- accepts: `{ qap, package_type }`
- Validate QAP number against `bmf_advertising_profiles` table (or wherever QAP numbers are stored)
- Create an `ad_banners` row linked to the QAP owner's partner account
- Apply package defaults (units_reward, cooldown_hours, etc.) based on package_type
- Return created banner ID so user can manage it on dashboard
- Auth required (user must be signed in to launch)

**Impact:** Without this, QAP input is cosmetic. Users enter their QAP number but no actual campaign is created.

---

## 4. Seed Banner Data

**Status:** DONE (script created, needs running)

**What it does:** Seeds 8 placeholder banner rows in `ad_banners` table so `GET /api/ads/public` returns real data instead of empty array.

**Current state:**
- Seed script created at `backend/seed-banners.js`
- Inserts 8 `[DEMO]` prefixed banners with various targeting types
- Idempotent (checks for existing demo banners before inserting)
- Script needs to be run: `node backend/seed-banners.js`

**Impact:** Without running the seed, the BANQ feed shows mock banners from frontend JS instead of real DB rows.

---

## Summary

| # | Item | Status | Blocking? |
|---|------|--------|-----------|
| 1 | Billboard Declaration Endpoint | DEFERRED | No (placeholder data works) |
| 2 | Contact Form Backend | DEFERRED | No (toast shows success) |
| 3 | QAP Integration | PARTIALLY DONE | No (frontend cosmetic only) |
| 4 | Seed Banner Data | DONE (needs running) | No (script ready) |

None of these block the site from functioning. All pages work with placeholder/mock data. These are enhancements that make the site fully functional end-to-end.
