# QwkBrowser Responsive Breakpoint Standard

> **ID:** QWK-RB-001
> **Status:** ACTIVE RULE
> **Reference:** AGENTS.md Rule 28
> **Created:** 2026-08-20

---

## 1. Why This Exists

QwkBrowser is a social platform. Social platforms are used on phones first,
tablets second, desktops third. Every page must work well at every screen size.
This document defines the standard breakpoints and the rules for applying them.

If you build a new page or modify an existing layout, you MUST follow these
breakpoints. Do not invent your own.

---

## 2. Standard Breakpoints

QwkBrowser uses three tiers:

| Tier | Name | CSS Range | Target Devices |
|------|------|-----------|----------------|
| 1 | Desktop | > 1024px | Laptops, desktops, large tablets (landscape) |
| 2 | Tablet | 481px - 1024px | iPads (portrait/landscape), small laptops |
| 3 | Phone | <= 480px | iPhones, Android phones, small devices |

### 2.1 Breakpoint Values

```css
/* Default (desktop) styles -- no media query needed */

/* Tablet: <= 1024px */
@media (max-width: 1024px) { ... }

/* Phone: <= 480px */
@media (max-width: 480px) { ... }
```

### 2.2 Column Collapse Rule

Multi-column grids (sidebar + main content) collapse to single column
at the point where the main content area would be narrower than 520px.

Formula: `collapse_at = sidebar_width + 20px gap + 520px minimum_content`

Common cases:
- 340px sidebar -> collapse at 880px (round to 900px)
- 280px sidebar -> collapse at 820px
- No sidebar -> no collapse needed

Use `max-width` on the collapse, not `min-width`:

```css
.grid { display: grid; grid-template-columns: 1fr 340px; gap: 20px; }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
```

---

## 3. Phone-Specific Adjustments (<= 480px)

At phone width, the following adjustments are MANDATORY:

### 3.1 Padding
- Container side padding: 12px (not 20px or 24px)
- Card padding: 12px (not 16px or 24px)

### 3.2 Typography
- Page titles: 20px (not 28px)
- Section titles: 16px (not 18px)
- Body text: 13px (unchanged)
- Mono/labels: 10px (unchanged)

### 3.3 Avatars
- Profile avatar: 64px (not 80px)
- Post avatar: 32px (not 36px)
- Chat avatar: 24px (not 28px)

### 3.4 Tab Bars
- Must scroll horizontally or wrap to second row
- Tab padding: 10px 14px (not 12px 20px)
- Tab font: 11px (not 12px)
- `white-space: nowrap` on each tab
- `overflow-x: auto` on the tab container

### 3.5 Stats
- Stat value: 18px (not 20px)
- Stat label: 9px (not 10px)
- Gap between stats: 16px (not 20px)

### 3.6 Buttons
- Full-width buttons: padding 10px (not 12px)
- Inline buttons: padding 8px 14px (not 10px 16px)

---

## 4. Tablet-Specific Adjustments (481px - 1024px)

### 4.1 Single-Column Layout
- Grids collapse to single column (see 2.2)
- Sidebar content appears below main content
- Full padding is retained (no reduction needed)

### 4.2 Tab Bars
- Tab bars can remain on one line if they fit
- If 6+ tabs, consider scrollable tab bar

---

## 5. Desktop Layout (> 1024px)

### 5.1 Multi-Column
- Two-column grid: main content (1fr) + sidebar (fixed width)
- Sidebar width: 280px-340px depending on content
- Gap: 20px

### 5.2 Container
- Max-width: 1200px
- Side padding: 20px-24px

---

## 6. Rules for Agents

1. **Every new page must include phone and tablet breakpoints.**
   No exceptions. If you build a page without breakpoints, you are breaking
   the platform for the majority of users.

2. **Use the standard values.** Do not invent custom breakpoints.
   480px for phone, 1024px for tablet. These are not arbitrary -- they map
   to real device boundaries.

3. **Test mentally at 375px.** Before declaring a page done, imagine it
   on an iPhone SE (375px wide). Does the layout work? Are tabs accessible?
   Is text readable? If not, add phone-specific CSS.

4. **Do not use min-width for mobile-first.** QwkBrowser uses max-width
   (desktop-first) because the base styles target desktop and overrides
   reduce for smaller screens. This matches the existing codebase pattern.

5. **Column collapse is not optional.** If a page has a sidebar, it MUST
   collapse to single column at the appropriate breakpoint. A 340px sidebar
   on a 375px phone is unacceptable.

---

## 7. Device Reference

Real device widths for testing:

### Phones
| Device | Width (px) |
|--------|-----------|
| iPhone SE | 375 |
| iPhone 14/15 | 390 |
| iPhone 14/15 Pro | 393 |
| iPhone Pro Max | 430 |
| Samsung Galaxy S23 | 360 |
| Google Pixel 7 | 412 |
| Samsung Galaxy Note | 412 |

### Tablets
| Device | Portrait (px) | Landscape (px) |
|--------|--------------|----------------|
| iPad Mini | 768 | 1024 |
| iPad (10th gen) | 820 | 1180 |
| iPad Air | 820 | 1180 |
| iPad Pro 11" | 834 | 1194 |
| iPad Pro 12.9" | 1024 | 1366 |

### Laptops
| Device | Width (px) |
|--------|-----------|
| Small laptop | 1280 |
| Standard laptop | 1440 |
| Desktop | 1920+ |

---

## 8. Verification

When verifying responsive design:
1. Open the page in a browser
2. Open DevTools (F12)
3. Toggle device toolbar (Ctrl+Shift+M)
4. Test at 375px (iPhone SE), 768px (iPad), 1024px (iPad landscape), 1440px (laptop)
5. Confirm: layout works at all four widths
6. Confirm: no horizontal scrolling at phone width
7. Confirm: tabs are accessible (scrollable or wrapped)
8. Confirm: text is readable (not cut off or overlapping)
