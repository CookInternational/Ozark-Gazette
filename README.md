[README (1).md](https://github.com/user-attachments/files/29530618/README.1.md)
# The Ozark Gazette Backend v1.3.0

![The Ozark Gazette](https://ozarks.cgnnews.net/OzarkGazetteLogo.png)

**The Ozark Gazette**  
**Ozarks local news, weather, traffic, sports, obituaries and classifieds**  
**Documentation version:** v1.3.0  
**Backend release:** `OzarkGazettev1.0 Router Isolation Fix`  
**CGN shared backend compatibility:** `v11.5.7-autonews22-local-ozarks-router-fix`  
**Last updated:** 01 July 2026 at 01:50:04Z UTC  
**Copyright © 2026 Cook Global News Network. All Rights Reserved.**

---

## Overview

This repository documents **The Ozark Gazette** backend extension for `https://ozarks.cgnnews.net`.

The Ozark Gazette uses its own Google Sheet, its own article/archive/obituary/classifieds tabs, its own Ozarks source registry and its own `ozark_...` public API actions. When installed inside the shared CGN Apps Script project, the Ozark backend must remain a route-only extension so it does not override the main CGN News article feed.

This release updates the README for the Ozark router-isolation fix. The important rule is simple: **The Ozark Gazette routes stay prefixed with `ozark_`, and the Ozark extension does not define its own `doGet(e)` or `doPost(e)` inside the shared CGN Apps Script project.**

---

## Current release: OzarkGazettev1.0 Router Isolation Fix

### Primary fix

The router-isolation fix keeps The Ozark Gazette from crashing or hijacking the main `cgnnews.net` site when both systems are present in the same Apps Script project.

In the shared CGN Apps Script project:

- **Only the main CGN backend may define `doGet(e)` and `doPost(e)`.**
- The Ozark Gazette extension must be installed as a route-only extension.
- Ozark public actions must begin with `ozark_`.
- CGN News actions such as `articles`, `article`, `articles_paged`, `weather_articles` and `sports_articles` must continue routing to the main CGN spreadsheet.
- Ozark actions such as `ozark_articles`, `ozark_article`, `ozark_obituaries`, `ozark_classifieds` and `ozark_health` must route to the Ozark spreadsheet only.

### Why this matters

A standalone Ozark extension with its own global `doGet(e)` and `doPost(e)` can shadow the shared Apps Script Web App route. That can make `action=articles` return an Ozark error or an empty response instead of the main CGN News Articles feed.

The corrected model is:

```text
Shared CGN Web App doGet/doPost
        |
        |-- ozark_... actions --> ozarkGazetteRoute_(payload) --> Ozark Gazette spreadsheet
        |
        |-- all other actions --> CGN News backend routes --> CGN News spreadsheet
```

---

## Ozark source-of-truth model

### Site

```text
https://ozarks.cgnnews.net
```

### Spreadsheet

The Ozark Gazette backend reads and writes to the Ozark spreadsheet configured as:

```text
OGZ_SPREADSHEET_ID = 1Xz9bnMqb-tkHeo2N2UonUbBr1jpo1VzKcVbBW_PU2n0
```

### Tabs

The Ozark Gazette source-of-truth tabs are:

```text
Articles
Archives
Obituaries
Classifieds
```

### Default images

```text
Ozark logo:       https://ozarks.cgnnews.net/OzarkGazetteLogo.png
Ozark banner:     https://ozarks.cgnnews.net/OzarkGazetteBanner.png
Obituary image:   https://ozarks.cgnnews.net/obituaries/RestInPeace.webp
```

---

## Public API actions

The Ozark Gazette uses `ozark_...` actions only.

### Health

```text
action=ozark_health
```

### Articles and archives

```text
action=ozark_articles
action=ozark_articles&limit=20
action=ozark_articles&category=Local
action=ozark_article&slug=<ozark-slug>
action=ozark_archives
action=ozark_archive_move_old_articles
```

### Obituaries

```text
action=ozark_obituaries
action=ozark_obituaries&limit=15
action=ozark_obituary&slug=<obituary-slug>
action=ozark_sync_obituaries
action=ozark_obituaries_headers
action=ozark_obituaries_ensure_sheet
```

### Classifieds

```text
action=ozark_classifieds
action=ozark_classified&slug=<classified-slug>
action=ozark_classified_submit
action=ozark_classifieds_headers
action=ozark_classifieds_ensure_sheet
```

### Source registry

```text
action=ozark_sources
action=ozark_obituary_sources
action=ozark_court_sources
```

---

## Ozark content modules

### Articles

The `Articles` tab powers current Ozark Gazette local stories, weather briefs, traffic briefs, sports briefs and general coverage.

### Archives

The `Archives` tab stores older Ozark Gazette articles after the configured archive window.

```text
OGZ_ARCHIVE_AFTER_HOURS = 168
```

### Obituaries

The `Obituaries` tab powers the Ozark Gazette obituary listing and detail views. The backend includes an obituary source registry and can monitor Ozark-area obituary sources.

Primary obituary source configured in the backend:

```text
https://www.ozarkcountytimes.com/obituaries
```

### Classifieds

The `Classifieds` tab powers paid local classifieds. Classified submissions save as `pending_review` and use PayPal hosted-button metadata for the selected word-limit plan.

---

## Ozark AutoNews22

The Ozark Gazette backend includes Ozark AutoNews22 actions for daily and hourly local service coverage.

### Public/manual actions

```text
action=ozark_autonews22_status
action=ozark_autonews22_enable
action=ozark_autonews22_disable
action=ozark_autonews22_dispatcher
action=ozark_autonews22_run_traffic_brief
action=ozark_autonews22_run_daily_weather
action=ozark_autonews22_run_severe_weather
action=ozark_autonews22_run_sports_brief
action=ozark_autonews22_publish_general
```

### Scheduled coverage

```text
Daily Traffic Brief:       05:00 CT
Daily Weather Brief:       06:00 CT
Severe Weather Checks:     Hourly
Daily Sports Brief:        17:00 CT
```

AutoNews22 publishes only to the Ozark `Articles` sheet and should not write to the main CGN News Articles sheet.

---

## Source rules

The Ozark Gazette follows CGN source-first standards while using Ozarks-local categories and source lanes.

### Weather

Weather and severe-weather coverage must remain official-source first.

Approved Ozark weather source lanes include:

```text
National Weather Service Springfield
NOAA
NWS Radar
Open-Meteo
```

### Traffic

Traffic coverage must not invent road closures, crashes or emergency conditions.

Approved Ozark traffic source lanes include:

```text
MoDOT Traveler Information
MoDOT Road Conditions
Missouri State Highway Patrol crash reports
```

### Courts and public records

Court and public-record coverage must be cautious, record-based and source-attributed.

Approved Ozark court source lanes include:

```text
Missouri Case.net
Missouri Courts
Ozark County Times court reporting as secondary local context
```

### Obituaries

Obituary monitoring may use local funeral-home and local-news obituary pages, but dates, names, ages and service details should remain source-grounded.

---

## Deployment checklist

Use this order when deploying the Ozark router-isolation fix:

1. Replace the main CGN backend file with the v11.5.7 router-fix backend.
2. Replace the Ozark Gazette extension file with the router-only Ozark extension.
3. Confirm the Apps Script project has exactly one global `function doGet(e)`.
4. Confirm the Apps Script project has exactly one global `function doPost(e)`.
5. Confirm both global entry points are in the main CGN backend file.
6. Confirm the Ozark extension does **not** define `doGet(e)` or `doPost(e)`.
7. Deploy a new Apps Script Web App version.
8. Run the smoke tests below before assuming either site is fixed.

---

## Smoke tests

### Ozark Gazette

```text
action=ozark_health
action=ozark_articles
action=ozark_article&slug=<ozark-slug>
action=ozark_obituaries
action=ozark_classifieds
action=ozark_autonews22_status
```

Expected result: Ozark responses load from the Ozark spreadsheet only.

### Main CGN News compatibility

```text
action=getbackendversion
action=site_config
action=articles
action=articles_paged&limit=10
action=article&slug=<main-cgn-slug>
action=weather_articles&limit=5
action=sports_articles&limit=5
```

Expected result: main CGN News article feeds still load from the main CGN spreadsheet.

### Failure signs

Investigate immediately if:

- `action=articles` returns an Ozark response.
- `action=articles` returns empty while the CGN Articles sheet has published rows.
- `action=ozark_articles` returns CGN News articles.
- Apps Script contains more than one global `doGet(e)` or more than one global `doPost(e)`.
- `ozarks.cgnnews.net` loads the shell but not Ozark articles.
- `cgnnews.net` loads the shell but not CGN articles.

---

## Rule going forward

Do not add standalone product extensions to the shared CGN Apps Script project with their own Web App entry points.

Every extension must follow this route-only pattern:

```javascript
function productRoute_(payload) {
  if (!String(payload.action || "").startsWith("product_")) return null;
  return handleProductAction_(payload);
}
```

The Ozark version is:

```javascript
function ozarkGazetteRoute_(payload) {
  payload = payload || {};
  var action = String(payload.action || "").trim();
  if (!/^ozark_/i.test(action)) return null;
  return OGZ_handleAction_(payload);
}
```

Never duplicate this outside the main CGN backend file:

```javascript
function doGet(e) { ... }
function doPost(e) { ... }
```

---

## Support

Ozark site: `https://ozarks.cgnnews.net`  
Main CGN site: `https://www.cgnnews.net`  
Newsroom contact: `tips@cgnnews.net`

**Copyright © 2026 Cook Global News Network. All Rights Reserved.**
