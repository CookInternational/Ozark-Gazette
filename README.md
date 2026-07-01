[README.md](https://github.com/user-attachments/files/29530506/README.md)
# CGN News Backend

![CGN News](https://www.cgnnews.net/CGNNewsLogo01.png)

**Cook Global News Network / CGN News**  
**Documentation version:** v1.1.0  
**Backend release:** `CGN NEWS BACKEND v11.5.7 AutoNews22 Local Traffic Advisory + OzarkGazettev1.0 Router Isolation Fix`  
**Backend slug:** `v11.5.7-autonews22-local-ozarks-router-fix`  
**Last updated:** 01 July 2026 at 01:50:04Z UTC  
**Copyright © 2026 Cook Global News Network. All Rights Reserved.**

---

## Overview

This repository contains the canonical Google Apps Script backend for **CGN News** at `https://www.cgnnews.net`.

The backend powers article loading, article search, reporter profiles, subscriptions, newsletters, editorial tools, static article publishing, archive routing, weather automation, traffic advisories, CGN LLM editorial review tools and the isolated Ozark Gazette extension route.

This release is a router-isolation update. It preserves the main CGN News article API while allowing **The Ozark Gazette** to operate from its own spreadsheet through `ozark_...` actions only.

---

## Current release: v11.5.7

### Primary fix

The v11.5.7 router fix isolates Ozark Gazette routing so it cannot override the main CGN News public article feed.

In the shared Apps Script project:

- **Only the main CGN backend may define `doGet(e)` and `doPost(e)`.**
- The Ozark Gazette extension must be included as an extension route only.
- Ozark actions must be prefixed with `ozark_`.
- Main CGN actions such as `articles`, `article`, `articles_paged`, `weather_articles` and `sports_articles` must continue to route to the main CGN Articles sheet.

### Why this matters

A standalone Ozark extension with its own `doGet(e)` and `doPost(e)` can shadow or hijack the public Apps Script Web App route. That can make `action=articles` stop returning CGN News articles and cause the main site to appear empty.

The corrected model is:

```text
CGN Web App doGet/doPost
        |
        |-- ozark_... actions --> ozarkGazetteRoute_(payload) --> Ozark spreadsheet
        |
        |-- all other CGN actions --> CGN backend routes --> CGN spreadsheet
```

---

## Source-of-truth model

### Main CGN News

Main CGN News content is controlled by the main CGN backend and its configured CGN spreadsheet.

Core tabs include:

- `Articles`
- `Reporters`
- `Users`
- `Admin`
- `Payments`
- `CheckoutSessions`
- `Logs`
- `Newsletter`
- `SpecialNewsletter`
- `SpecialNewsletterSends`
- `Reports`
- `LLM`
- `ElectionCenter`
- `Advertisers`

### Archives

Long-term archives read the configured Archives Google Sheet tab by GID as the source of truth.

There is no `archive-index.json` source of truth and no static JSON dependency for `archives.cgnnews.net`.

### Ozark Gazette

The Ozark Gazette uses its own spreadsheet and must remain route-isolated from the main CGN News backend.

Allowed public Ozark actions include:

- `ozark_health`
- `ozark_articles`
- `ozark_archives`
- `ozark_article`
- `ozark_obituaries`
- `ozark_obituary`
- `ozark_classifieds`
- `ozark_classified`
- `ozark_classified_submit`
- `ozark_sources`

Ozark automation and admin actions must also keep the `ozark_` prefix.

---

## Public API actions

The backend supports these core public actions through the Apps Script Web App URL.

### Articles

```text
action=articles
action=articles&format=paged
action=articles_paged
action=article&slug=<article-slug>
action=weather_articles
action=sports_articles
action=reporter_articles
action=articles_by_author
```

### Reporters

```text
action=reporters
action=reporter&slug=<reporter-slug>
action=reporter_profile&slug=<reporter-slug>
```

### Site configuration

```text
action=site_config
action=getbackendversion
action=cgnimagedefaultsstatus
action=all
```

### Newsletter and account routes

```text
action=newsletter
action=unsubscribe_newsletter
action=newsletter_test
action=newsletter_daily_send
action=special_newsletter_daily_send
action=login
action=signup
action=subscription_status
action=account_details
```

---

## Editor and protected actions

Editor actions are routed through the protected editor layer and should not be exposed as general public website calls.

Important protected/editor workflows include:

- Editor login and session validation
- Article creation and update
- Google Drive editor image upload
- Manual hero-image protection
- Editorial AI review
- Manual copy editing for pending drafts
- Logs panel actions
- LLM prompt, lesson and audit controls
- Static publishing workflow dispatch
- Archive rebuild and archive mover tools

Public `doGet` blocks unsafe archive write/move/build actions from direct public execution. Use Apps Script Run menu or protected editor routes for those workflows.

---

## Editorial safeguards

The backend includes hard editorial gates for CGN News standards.

### Article requirements

Canonical article rows must preserve the 21-column CGN schema:

```text
article_id, title, subtitle, slug, category, tags, author, published_at, updated_at, summary, body_html, what_this_means, hero_image_url, image_credit, inline_images, featured, breaking, views, status, seo_title, seo_description
```

### Source rules

Articles must include a final paragraph:

```html
<p><strong>Additional Reporting By:</strong> ...</p>
```

The backend blocks or downgrades unsafe stories when public fields contain unsupported claims, generic source labels, missing source lines, duplicate stories, unsupported weather alerts or placeholder datelines.

### Weather rules

Daily Weather Briefs and Severe Weather Alerts are protected official-source weather flows when validation passes.

Weather articles must use approved weather and preparedness sources such as:

- National Weather Service
- NOAA
- Open-Meteo
- AccuWeather
- FEMA
- Ready.gov
- American Red Cross
- Relevant state emergency or transportation agencies

### Hero-image protection

Manual/editor-uploaded hero images are protected from category/default image overrides.

Google Drive editor uploads return website-ready thumbnail URLs and are preserved through later editorial AI or category-default passes.

---

## Static publishing

Published articles can trigger the configured GitHub Actions static publishing workflow.

Static publishing supports:

- Latest article builds
- Individual article builds
- Sitemap rebuilds
- News, Weather and Sports article paths
- Canonical article routing by date and slug

Article paths are built as:

```text
/news/YYYY/MM/DD/<slug>/
/weather/YYYY/MM/DD/<slug>/
/sports/YYYY/MM/DD/<slug>/
```

---

## Deployment checklist

Use this order when deploying the v11.5.7 router isolation fix:

1. Replace the main CGN backend file with the v11.5.7 router-fix backend.
2. Replace the Ozark Gazette extension with the router-only extension.
3. Confirm the Apps Script project has exactly one `function doGet(e)` and exactly one `function doPost(e)`.
4. Confirm both entry points are in the main CGN backend file.
5. Confirm the Ozark extension does **not** define `doGet(e)` or `doPost(e)`.
6. Deploy a new Apps Script Web App version.
7. Test the smoke-test actions below before assuming the website is fixed.

---

## Smoke tests

Run these checks after every backend deployment.

### Main CGN News

```text
action=getbackendversion
action=site_config
action=articles
action=articles_paged&limit=10
action=article&slug=<main-cgn-slug>
action=weather_articles&limit=5
action=sports_articles&limit=5
```

Expected result: main CGN News article feeds load from the main CGN spreadsheet.

### Ozark Gazette

```text
action=ozark_health
action=ozark_articles
action=ozark_article&slug=<ozark-slug>
action=ozark_obituaries
action=ozark_classifieds
```

Expected result: Ozark Gazette routes load from the Ozark spreadsheet only.

### Failure signs

Investigate immediately if:

- `action=articles` returns an Ozark response.
- `action=articles` returns an empty feed while the CGN Articles sheet has published rows.
- `action=ozark_articles` returns CGN News articles.
- Apps Script contains more than one global `doGet(e)` or more than one global `doPost(e)`.
- The website loads headers/footers but no articles.

---

## Rule going forward

Do not add standalone product extensions to the shared CGN Apps Script project with their own Web App entry points.

Every extension must follow this pattern:

```javascript
function productRoute_(payload) {
  if (!String(payload.action || "").startsWith("product_")) return null;
  return handleProductAction_(payload);
}
```

Then the main CGN `doGet(e)` may call the extension route before continuing to normal CGN actions.

Never duplicate:

```javascript
function doGet(e) { ... }
function doPost(e) { ... }
```

outside the main CGN backend file.

---

## Canonical categories

CGN News canonical categories are:

```text
World
Politics
Business
Markets
Technology
Entertainment
Environment
Energy
Opinion
Local
Religion & Spirituality
Weather
Sports
Investigations
Special Reports
```

---

## Support

Tips and newsroom contact: `tips@cgnnews.net`  
Website: `https://www.cgnnews.net`

**Copyright © 2026 Cook Global News Network. All Rights Reserved.**
