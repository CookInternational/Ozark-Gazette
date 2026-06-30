# The Ozark Gazette

**Build:** v1.1.0-alpha-production-ready  
**Updated:** 2026-06-30T21:47:52Z UTC  
**Site:** https://ozarks.cgnnews.net  
**Repository:** https://github.com/CookInternational/Ozark-Gazette

![The Ozark Gazette](/OzarkGazetteLogo.png)

The Ozark Gazette is a professional local newspaper web app for Tecumseh, Ozark County and the Missouri Ozarks. It is a static GitHub Pages-style front end that uses the shared CGN backend for account, subscription and payment logic, while using an Ozark-specific Apps Script extension for Ozark articles, archives, obituaries and AutoNews.

## Production endpoints

| Item | Value |
|---|---|
| Public site | `https://ozarks.cgnnews.net` |
| Apps Script Web App URL | `https://script.google.com/macros/s/AKfycbw2U1Qezn44zJNnonZMZG06LpB7lh6n7cgiJY8hY34RnriYd2Eq66swuxQ7S_VyHobb/exec` |
| Google Sheet | `1Xz9bnMqb-tkHeo2N2UonUbBr1jpo1VzKcVbBW_PU2n0` |
| Canonical sheet tabs | `Articles`, `Archives`, `Obituaries` |
| Contact | `tips@cgnnews.net` / `(317) 442-1437` |
| Address | P.O. Box 794, 33256 US Highway 160, Tecumseh, Missouri 65760 |

## What changed in v1.1.0-alpha

- Updated every public website reference to the redeployed Apps Script Web App URL.
- Restored Ozark article display to use `site=ozark&action=ozark_articles` for current stories.
- Added `/archives/`, a professional archive page that reads `site=ozark&action=ozark_archives` from the canonical `Archives` tab.
- Replaced the partial Ozark Apps Script extension with the full Ozark backend extension, including article, archive, obituary and AutoNews22 routes.
- Preserved CGN account, subscription and PayPal logic on the CGN backend route actions: `login`, `signup`, `account_details`, `subscription_status` and `confirm_payment`.
- Updated the global shell weather mini-card so the header uses current National Weather Service observations when available, matching the full Weather page behavior and preventing active alerts or stale Open-Meteo codes from forcing the header to show “Storm.”
- Added a manual static article page workflow with a required confirmation prompt before building SEO-friendly `/news/YYYY/MM/DD/slug/`, `/weather/YYYY/MM/DD/slug/` and `/sports/YYYY/MM/DD/slug/` pages.
- Added the Archives route to navigation, footer and sitemap.
- CGN LIVE and CGN Weather embed/source links in the homepage CGN LIVE module were not changed.

## Sheet contracts

### Articles and Archives

Both `Articles` and `Archives` use the canonical article schema:

```tsv
article_id	title	subtitle	slug	category	tags	author	published_at	updated_at	summary	body_html	what_this_means	hero_image_url	image_credit	inline_images	featured	breaking	views	status	seo_title	seo_description	display_order
```

Current stories stay in `Articles`. The archive automation moves published stories older than 168 hours to `Archives`. Article lookup checks both tabs so old links continue to work after a story moves.

### Obituaries

`Obituaries` uses this schema:

```tsv
obit_id	name	age	slug	source_name	source_url	source_published_at	published_at	updated_at	date_of_death	service_date	location	summary	body_html	image_url	image_credit	imported_at	last_seen_at	status
```

The obituary page reads `site=ozark&action=ozark_obituaries`. Individual obituary lookups use `ozark_obituary`.

## Apps Script deployment contract

The file `apps-script/OzarkGazette.gs` must be added to the existing CGN Apps Script project. The CGN backend remains the account source of truth. Add this route hook to the CGN `doGet(e)` handler after the payload/action variables are normalized and before the default response:

```javascript
var ozarkResponse = ozarkGazetteRoute_(getRequestPayload_(e));
if (ozarkResponse) return json(ozarkResponse);
```

This is safe because `ozarkGazetteRoute_(payload)` returns `null` unless the action starts with `ozark_`. That means account actions continue to run through CGN exactly as before.

## Front-end route map

| Route | Purpose | Data source |
|---|---|---|
| `/` | Homepage carousel, headlines, weather, traffic, sports, markets and CGN LIVE takeover | Ozark articles + static widgets |
| `/news/` | Current articles and category search | `ozark_articles` / `Articles` |
| `/archives/` | Older articles after one-week archive move | `ozark_archives` / `Archives` |
| `/article.html?slug=...` | Live article reader | `ozark_article` / `Articles` then `Archives` |
| `/obituaries/` | Obituary feed | `ozark_obituaries` / `Obituaries` |
| `/weather/` | Full Tecumseh weather page | Open-Meteo + NWS/current observation + Ozark Weather articles |
| `/weather/radar/` | Radar and official weather links | Static page + official sources |
| `/traffic/` | Traffic center | MoDOT and Ozark sources |
| `/sports/` | Sports page | Ozark Sports articles |
| `/markets/` and `/markets/center/` | Market coverage and widgets | CGN/TradingView widgets + Ozark articles |

## Article display rules

- Current article grids should call the redeployed web app with `site=ozark&action=ozark_articles`.
- Archive grids should call `site=ozark&action=ozark_archives`.
- Individual article display should call `site=ozark&action=ozark_article&slug=...`.
- The backend returns a default hero image when a story does not have one.
- Category pages should use canonical Ozark categories: `Local`, `US`, `World`, `Politics`, `Investigations`, `Markets`, `Technology`, `Opinion`, `Environment`, `Entertainment`, `Obituaries`, `Weather`, `Traffic`, `Sports`.

## Weather shell rule

The global header weather mini-card uses the same principle as the full Weather page: current observed weather controls the condition text when available. NWS alerts stay separate from current conditions. A heat warning, thunderstorm watch, flood warning or other alert must not force the header to display Storm or Rain unless the latest observation text supports that condition.

## AutoNews22 for Ozark Gazette

The Ozark Apps Script extension includes AutoNews22 routes:

- `ozark_autonews22_enable`
- `ozark_autonews22_disable`
- `ozark_autonews22_status`
- `ozark_autonews22_dispatcher`
- `ozark_autonews22_run_traffic_brief`
- `ozark_autonews22_run_daily_weather`
- `ozark_autonews22_run_severe_weather`
- `ozark_autonews22_run_sports_brief`
- `ozark_autonews22_publish_general`

AutoNews authors are limited to the CGN St. Louis/Ozark reporter set used by this project: Jordan Whitaker for general/local/traffic, Elise Navarro for weather/severe weather and Marcus Bell for sports. Michael A. Cook remains the editor/special-author option.

## Static article build workflow

The separate workflow file is:

```text
.github/workflows/ozark-static-news-pages.yml
```

It is manually triggered and requires typing:

```text
BUILD OZARK STATIC PAGES
```

The workflow fetches `ozark_articles` and, by default, `ozark_archives`, then writes SEO-friendly static article folders under `/news/`, `/weather/` and `/sports/`, plus `static-news-sitemap.xml`. The workflow can commit those generated pages back to `main`.

## Deployment commands

From the repository root after replacing files:

```bash
git status
git add .
git commit -m "Update Ozark Gazette web app, archives and article display"
git push origin main
```

To add the separate workflow manually without the full ZIP, upload `ozark-static-news-pages.yml` to:

```text
.github/workflows/ozark-static-news-pages.yml
```

## Verification checklist

1. `/news/` loads current articles from the Ozark `Articles` tab.
2. `/archives/` loads older articles from the Ozark `Archives` tab.
3. `/article.html?slug=...` opens stories from either `Articles` or `Archives`.
4. `/obituaries/` loads the canonical `Obituaries` tab.
5. The header weather condition matches the full Weather page current-condition logic.
6. Account login/signup still calls CGN actions, not Ozark article actions.
7. CGN LIVE source buttons and CGN Weather embed/source links remain unchanged.
8. `sitemap.xml` includes `/archives/`.
9. The static workflow prompts before writing generated article pages.

© 2026 Cook Global News Network / CGN News. All rights reserved.
