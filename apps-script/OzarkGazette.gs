
/**
 * The Ozark Gazette backend extension for the CGN Apps Script project.
 * Site: https://ozarks.cgnnews.net
 * Sheet: 1Xz9bnMqb-tkHeo2N2UonUbBr1jpo1VzKcVbBW_PU2n0
 * Tabs: Articles, Archives, Obituaries
 * Add this file to the existing CGN Apps Script project as a separate .gs file.
 */
var OGZ_SPREADSHEET_ID = "1Xz9bnMqb-tkHeo2N2UonUbBr1jpo1VzKcVbBW_PU2n0";
var OGZ_SITE_URL = "https://ozarks.cgnnews.net";
var OGZ_ARTICLES_SHEET = "Articles";
var OGZ_ARCHIVES_SHEET = "Archives";
var OGZ_OBITUARIES_SHEET = "Obituaries";
var OGZ_ARCHIVE_AFTER_HOURS = 168;
var OGZ_OBITUARY_DEFAULT_IMAGE = "https://ozarks.cgnnews.net/obituaries/RestInPeace.webp";
var OGZ_OBITUARIES_SOURCE_URL = "https://www.ozarkcountytimes.com/obituaries";
var OGZ_OBITUARY_HEADERS = [
  "obit_id",
  "name",
  "age",
  "slug",
  "source_name",
  "source_url",
  "source_published_at",
  "published_at",
  "updated_at",
  "date_of_death",
  "service_date",
  "location",
  "summary",
  "body_html",
  "image_url",
  "image_credit",
  "imported_at",
  "last_seen_at",
  "status"
];
var OGZ_DEFAULT_IMAGE = "https://ozarks.cgnnews.net/OzarkGazetteBanner.png";

function ozarkGazetteRoute_(payload) {
  payload = payload || {};
  var action = String(payload.action || "").trim();
  if (!/^ozark_/i.test(action)) return null;
  return OGZ_handleAction_(payload);
}

function OGZ_handleAction_(payload) {
  var action = String(payload.action || "").trim();
  if (action === "ozark_health") return OGZ_health_();
  if (action === "ozark_articles") return OGZ_articles_(payload);
  if (action === "ozark_archives") return OGZ_archives_(payload);
  if (action === "ozark_article") return OGZ_article_(payload);
  if (action === "ozark_move_old_articles" || action === "ozark_archive_move_old_articles") return OGZ_moveOldArticlesToArchives_(payload);
  if (action === "ozark_archive_trigger_create") return OGZ_createArchiveTrigger_();
  if (action === "ozark_archive_trigger_delete") return OGZ_deleteArchiveTrigger_();
  if (action === "ozark_archive_trigger_status") return OGZ_archiveTriggerStatus_();
  if (action === "ozark_sources") return OGZ_sourceRegistry_();
  if (action === "ozark_obituary_sources") return OGZ_obituarySources_();
  if (action === "ozark_court_sources") return OGZ_courtSources_();
  if (action === "ozark_obituaries") return OGZ_obituaries_(payload);
  if (action === "ozark_obituary") return OGZ_obituary_(payload);
  if (action === "ozark_obituaries_headers") return OGZ_obituariesHeaders_();
  if (action === "ozark_obituaries_ensure_sheet") return OGZ_ensureObituariesSheetAction_();
  if (action === "ozark_sync_obituaries") return OGZ_syncObituaries_(payload);
  if (action === "ozark_obituaries_trigger_create") return OGZ_createObituariesTrigger_();
  if (action === "ozark_obituaries_trigger_delete") return OGZ_deleteObituariesTrigger_();
  if (action === "ozark_obituaries_trigger_status") return OGZ_obituariesTriggerStatus_();
  if (action === "ozark_autonews22_enable") return OGZ_AutoNews22Enable();
  if (action === "ozark_autonews22_disable") return OGZ_AutoNews22Disable();
  if (action === "ozark_autonews22_status") return OGZ_AutoNews22Status();
  if (action === "ozark_autonews22_dispatcher") return OGZ_AutoNews22Dispatcher(payload);
  if (action === "ozark_autonews22_run_traffic_brief") return OGZ_AutoNews22PublishTrafficBrief_(payload);
  if (action === "ozark_autonews22_run_daily_weather") return OGZ_AutoNews22PublishDailyWeatherBrief_(payload);
  if (action === "ozark_autonews22_run_severe_weather") return OGZ_AutoNews22SevereWeatherCheck(payload);
  if (action === "ozark_autonews22_run_sports_brief") return OGZ_AutoNews22PublishSportsBrief_(payload);
  if (action === "ozark_autonews22_publish_general") return OGZ_AutoNews22PublishGeneralFromPayload_(payload);
  return { success:false, error:"Unknown Ozark Gazette action", action:action };
}

function OGZ_health_() {
  return { success:true, site:"The Ozark Gazette", url:OGZ_SITE_URL, spreadsheet_id:OGZ_SPREADSHEET_ID, sheets:[OGZ_ARTICLES_SHEET, OGZ_ARCHIVES_SHEET, OGZ_OBITUARIES_SHEET], checked_at:new Date().toISOString() };
}

function OGZ_ss_(){ return SpreadsheetApp.openById(OGZ_SPREADSHEET_ID); }
function OGZ_sheet_(name){ var sh=OGZ_ss_().getSheetByName(name); if(!sh) throw new Error("Missing sheet: "+name); return sh; }
function OGZ_headerMap_(sheet){ var headers=sheet.getRange(1,1,1,Math.max(1,sheet.getLastColumn())).getValues()[0]; var m={}; headers.forEach(function(h,i){ m[String(h||"").trim()] = i; }); return m; }
function OGZ_get_(row,h,name){ return h[name] === undefined ? "" : row[h[name]]; }
function OGZ_safe_(v){ return v === null || v === undefined ? "" : String(v); }
function OGZ_bool_(v){ return v === true || String(v).toLowerCase() === "true" || String(v) === "1"; }
function OGZ_slugify_(v){ return String(v||"").toLowerCase().replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-").replace(/-+/g,"-").replace(/^-+|-+$/g,""); }
function OGZ_time_(v){ var d=new Date(v); return isNaN(d.getTime()) ? 0 : d.getTime(); }
function OGZ_pad2_(v){ v = String(v); return v.length < 2 ? "0" + v : v; }

function OGZ_rowToArticle_(row,h,source) {
  var title = OGZ_safe_(OGZ_get_(row,h,"title"));
  var slug = OGZ_safe_(OGZ_get_(row,h,"slug")) || OGZ_slugify_(title);
  var published = OGZ_get_(row,h,"published_at") || OGZ_get_(row,h,"updated_at") || "";
  var d = OGZ_time_(published) ? new Date(published) : new Date();
  var y = d.getUTCFullYear();
  var m = OGZ_pad2_(d.getUTCMonth()+1);
  var day = OGZ_pad2_(d.getUTCDate());
  var url = "/article.html?slug=" + encodeURIComponent(slug);
  return {
    article_id:OGZ_safe_(OGZ_get_(row,h,"article_id")),
    title:title,
    subtitle:OGZ_safe_(OGZ_get_(row,h,"subtitle")),
    slug:slug,
    category:OGZ_safe_(OGZ_get_(row,h,"category")) || "Local",
    tags:OGZ_safe_(OGZ_get_(row,h,"tags")),
    author:OGZ_safe_(OGZ_get_(row,h,"author")) || "The Ozark Gazette",
    published_at:OGZ_safe_(published),
    updated_at:OGZ_safe_(OGZ_get_(row,h,"updated_at") || published),
    summary:OGZ_safe_(OGZ_get_(row,h,"summary")),
    body_html:OGZ_safe_(OGZ_get_(row,h,"body_html")),
    what_this_means:OGZ_safe_(OGZ_get_(row,h,"what_this_means")),
    hero_image_url:OGZ_safe_(OGZ_get_(row,h,"hero_image_url")) || OGZ_DEFAULT_IMAGE,
    image_credit:OGZ_safe_(OGZ_get_(row,h,"image_credit")),
    inline_images:OGZ_bool_(OGZ_get_(row,h,"inline_images")),
    featured:OGZ_bool_(OGZ_get_(row,h,"featured")),
    breaking:OGZ_bool_(OGZ_get_(row,h,"breaking")),
    views:Number(OGZ_get_(row,h,"views") || 0),
    status:OGZ_safe_(OGZ_get_(row,h,"status")) || "published",
    seo_title:OGZ_safe_(OGZ_get_(row,h,"seo_title")) || title,
    seo_description:OGZ_safe_(OGZ_get_(row,h,"seo_description")),
    display_order:OGZ_get_(row,h,"display_order") || "",
    url:url,
    canonical_url:OGZ_SITE_URL + url,
    year:String(y), month:m, day:day,
    source:source || "Articles"
  };
}

function OGZ_readSheet_(sheetName, payload) {
  payload = payload || {};
  var sh = OGZ_sheet_(sheetName);
  var h = OGZ_headerMap_(sh);
  var rows = sh.getDataRange().getValues();
  var category = OGZ_safe_(payload.category).toLowerCase();
  var limit = Math.min(Math.max(Number(payload.limit || 50), 1), 250);
  var offset = Math.max(Number(payload.offset || 0), 0);
  var out = [];
  for (var i=1;i<rows.length;i++) {
    var a = OGZ_rowToArticle_(rows[i], h, sheetName);
    if (!a.title) continue;
    var status = String(a.status || "published").toLowerCase();
    if (status && status !== "published" && status !== "archive" && status !== "archived") continue;
    if (category && String(a.category || "").toLowerCase() !== category) continue;
    out.push(a);
  }
  out.sort(function(a,b){
    var da = Number(a.display_order || 999999), db = Number(b.display_order || 999999);
    if (da !== db) return da - db;
    return OGZ_time_(b.published_at || b.updated_at) - OGZ_time_(a.published_at || a.updated_at);
  });
  return { success:true, site:"ozark", sheet:sheetName, total:out.length, articles:out.slice(offset, offset+limit), limit:limit, offset:offset, next_offset:(offset+limit<out.length?offset+limit:null) };
}

function OGZ_articles_(payload){ return OGZ_readSheet_(OGZ_ARTICLES_SHEET, payload); }
function OGZ_archives_(payload){ return OGZ_readSheet_(OGZ_ARCHIVES_SHEET, payload); }

function OGZ_article_(payload) {
  payload = payload || {};
  var slug = OGZ_safe_(payload.slug || payload.id || payload.article_id).trim();
  if (!slug) return { success:false, error:"Missing slug or article_id" };
  var sources = [OGZ_ARTICLES_SHEET, OGZ_ARCHIVES_SHEET];
  for (var s=0;s<sources.length;s++) {
    var sh = OGZ_sheet_(sources[s]);
    var h = OGZ_headerMap_(sh);
    var rows = sh.getDataRange().getValues();
    for (var i=1;i<rows.length;i++) {
      var a = OGZ_rowToArticle_(rows[i], h, sources[s]);
      if (a.slug === slug || a.article_id === slug) return { success:true, article:a, source:sources[s] };
    }
  }
  return { success:false, error:"Article not found", slug:slug };
}

function OGZ_moveOldArticlesToArchives_(payload) {
  payload = payload || {};
  var dryRun = String(payload.dry_run || "").toLowerCase() === "true" || payload.dry_run === true;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = OGZ_ss_();
    var src = ss.getSheetByName(OGZ_ARTICLES_SHEET);
    var dst = ss.getSheetByName(OGZ_ARCHIVES_SHEET);
    if (!src || !dst) throw new Error("Missing Articles or Archives sheet");
    var srcH = OGZ_headerMap_(src), dstH = OGZ_headerMap_(dst);
    var srcRows = src.getDataRange().getValues();
    var dstRows = dst.getDataRange().getValues();
    var existing = {};
    for (var d=1; d<dstRows.length; d++) {
      var id = OGZ_safe_(OGZ_get_(dstRows[d], dstH, "article_id"));
      if (id) existing[id] = true;
    }
    var cutoff = Date.now() - OGZ_ARCHIVE_AFTER_HOURS * 60 * 60 * 1000;
    var moved = [], skippedTooNew=0, skippedExisting=0, skippedDraft=0, deleteRows=[];
    for (var i=1; i<srcRows.length; i++) {
      var a = OGZ_rowToArticle_(srcRows[i], srcH, OGZ_ARTICLES_SHEET);
      if (!a.article_id && !a.title) continue;
      var status = String(a.status || "published").toLowerCase();
      if (status && status !== "published") { skippedDraft++; continue; }
      var t = OGZ_time_(a.published_at || a.updated_at);
      if (!t || t > cutoff) { skippedTooNew++; continue; }
      if (a.article_id && existing[a.article_id]) { skippedExisting++; deleteRows.push(i+1); continue; }
      var out = new Array(Math.max(dst.getLastColumn(), src.getLastColumn())).fill("");
      Object.keys(srcH).forEach(function(name){ if (dstH[name] !== undefined) out[dstH[name]] = srcRows[i][srcH[name]]; });
      if (dstH.status !== undefined) out[dstH.status] = "archived";
      if (!dryRun) dst.appendRow(out);
      moved.push({ article_id:a.article_id, title:a.title, published_at:a.published_at });
      deleteRows.push(i+1);
    }
    if (!dryRun) {
      deleteRows.sort(function(a,b){return b-a;}).forEach(function(r){ src.deleteRow(r); });
    }
    return { success:true, dry_run:dryRun, moved:moved.length, moved_articles:moved, skipped_too_new:skippedTooNew, skipped_existing:skippedExisting, skipped_non_published:skippedDraft, older_than_hours:OGZ_ARCHIVE_AFTER_HOURS, site:"ozark" };
  } finally { lock.releaseLock(); }
}

function OGZ_createArchiveTrigger_() {
  OGZ_deleteArchiveTrigger_();
  ScriptApp.newTrigger("OGZ_archiveDailyJob").timeBased().everyDays(1).atHour(3).create();
  return OGZ_archiveTriggerStatus_();
}
function OGZ_deleteArchiveTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function(t){ if (t.getHandlerFunction() === "OGZ_archiveDailyJob") ScriptApp.deleteTrigger(t); });
  return { success:true, deleted:true };
}
function OGZ_archiveTriggerStatus_() {
  var list = ScriptApp.getProjectTriggers().filter(function(t){ return t.getHandlerFunction() === "OGZ_archiveDailyJob"; });
  return { success:true, active:list.length>0, count:list.length, handler:"OGZ_archiveDailyJob" };
}
function OGZ_archiveDailyJob(){ return OGZ_moveOldArticlesToArchives_({}); }


function OGZ_obituariesHeaders_() {
  return { success:true, sheet:OGZ_OBITUARIES_SHEET, headers:OGZ_OBITUARY_HEADERS.slice(), note:"Obituaries does not use display_order." };
}

function OGZ_ensureObituariesSheetAction_() {
  var sh = OGZ_ensureObituariesSheet_();
  return { success:true, sheet:OGZ_OBITUARIES_SHEET, headers:OGZ_OBITUARY_HEADERS.slice(), columns:sh.getLastColumn() };
}

function OGZ_ensureObituariesSheet_() {
  var ss = OGZ_ss_();
  var sh = ss.getSheetByName(OGZ_OBITUARIES_SHEET);
  if (!sh) sh = ss.insertSheet(OGZ_OBITUARIES_SHEET);
  if (sh.getLastRow() < 1 || sh.getLastColumn() < 1 || String(sh.getRange(1,1).getValue() || "").trim() === "") {
    sh.clear();
    sh.getRange(1,1,1,OGZ_OBITUARY_HEADERS.length).setValues([OGZ_OBITUARY_HEADERS]);
    sh.setFrozenRows(1);
    return sh;
  }
  var h = OGZ_headerMap_(sh);
  var missing = [];
  OGZ_OBITUARY_HEADERS.forEach(function(name){ if (h[name] === undefined) missing.push(name); });
  if (missing.length) {
    sh.getRange(1, sh.getLastColumn()+1, 1, missing.length).setValues([missing]);
  }
  sh.setFrozenRows(1);
  return sh;
}

function OGZ_rowToObituary_(row, h) {
  var name = OGZ_safe_(OGZ_get_(row,h,"name"));
  var slug = OGZ_safe_(OGZ_get_(row,h,"slug")) || OGZ_slugify_(name);
  var published = OGZ_safe_(OGZ_get_(row,h,"published_at") || OGZ_get_(row,h,"source_published_at") || OGZ_get_(row,h,"imported_at") || OGZ_get_(row,h,"updated_at"));
  var url = "/obituaries/#" + encodeURIComponent(slug || OGZ_get_(row,h,"obit_id"));
  return {
    obit_id:OGZ_safe_(OGZ_get_(row,h,"obit_id")),
    name:name,
    age:OGZ_safe_(OGZ_get_(row,h,"age")),
    slug:slug,
    source_name:OGZ_safe_(OGZ_get_(row,h,"source_name")) || "The Ozark Gazette",
    source_url:OGZ_safe_(OGZ_get_(row,h,"source_url")),
    source_published_at:OGZ_safe_(OGZ_get_(row,h,"source_published_at")),
    published_at:published,
    updated_at:OGZ_safe_(OGZ_get_(row,h,"updated_at") || published),
    date_of_death:OGZ_safe_(OGZ_get_(row,h,"date_of_death")),
    service_date:OGZ_safe_(OGZ_get_(row,h,"service_date")),
    location:OGZ_safe_(OGZ_get_(row,h,"location")),
    summary:OGZ_safe_(OGZ_get_(row,h,"summary")),
    body_html:OGZ_safe_(OGZ_get_(row,h,"body_html")),
    image_url:OGZ_safe_(OGZ_get_(row,h,"image_url")) || OGZ_OBITUARY_DEFAULT_IMAGE,
    image_credit:OGZ_safe_(OGZ_get_(row,h,"image_credit")),
    imported_at:OGZ_safe_(OGZ_get_(row,h,"imported_at")),
    last_seen_at:OGZ_safe_(OGZ_get_(row,h,"last_seen_at")),
    status:OGZ_safe_(OGZ_get_(row,h,"status")) || "published",
    url:url,
    canonical_url:OGZ_SITE_URL + url
  };
}

function OGZ_obituaryTime_(obit) {
  return OGZ_time_(obit.published_at) || OGZ_time_(obit.source_published_at) || OGZ_time_(obit.updated_at) || OGZ_time_(obit.imported_at) || OGZ_time_(obit.date_of_death);
}

function OGZ_obituaries_(payload) {
  payload = payload || {};
  var sh = OGZ_ensureObituariesSheet_();
  var h = OGZ_headerMap_(sh);
  var rows = sh.getDataRange().getValues();
  var limit = Math.min(Math.max(Number(payload.limit || 15), 1), 100);
  var offset = Math.max(Number(payload.offset || 0), 0);
  var hours = Number(payload.hours || payload.recent_hours || 0);
  var cutoff = hours > 0 ? Date.now() - hours * 60 * 60 * 1000 : 0;
  var includeDrafts = String(payload.include_drafts || "").toLowerCase() === "true";
  var out = [];
  for (var i=1; i<rows.length; i++) {
    var o = OGZ_rowToObituary_(rows[i], h);
    if (!o.name) continue;
    var status = String(o.status || "published").toLowerCase();
    if (!includeDrafts && status && status !== "published") continue;
    var t = OGZ_obituaryTime_(o);
    if (cutoff && (!t || t < cutoff)) continue;
    out.push(o);
  }
  out.sort(function(a,b){ return OGZ_obituaryTime_(b) - OGZ_obituaryTime_(a); });
  return { success:true, site:"ozark", sheet:OGZ_OBITUARIES_SHEET, total:out.length, obituaries:out.slice(offset, offset+limit), items:out.slice(offset, offset+limit), limit:limit, offset:offset, next_offset:(offset+limit<out.length?offset+limit:null), hours:hours || null };
}

function OGZ_obituary_(payload) {
  payload = payload || {};
  var id = OGZ_safe_(payload.slug || payload.obit_id || payload.id).trim();
  if (!id) return { success:false, error:"Missing slug or obit_id" };
  var sh = OGZ_ensureObituariesSheet_();
  var h = OGZ_headerMap_(sh);
  var rows = sh.getDataRange().getValues();
  for (var i=1; i<rows.length; i++) {
    var o = OGZ_rowToObituary_(rows[i], h);
    if (o.slug === id || o.obit_id === id) return { success:true, obituary:o };
  }
  return { success:false, error:"Obituary not found", id:id };
}

function OGZ_syncObituaries_(payload) {
  payload = payload || {};
  var hours = Math.max(Number(payload.hours || 24), 1);
  var includeUnknownDates = String(payload.include_unknown_dates || "").toLowerCase() === "true" || payload.include_unknown_dates === true;
  var maxItems = Math.min(Math.max(Number(payload.max || payload.limit || 20), 1), 50);
  var sourceUrl = OGZ_safe_(payload.url || OGZ_OBITUARIES_SOURCE_URL);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sh = OGZ_ensureObituariesSheet_();
    var h = OGZ_headerMap_(sh);
    var existing = OGZ_obituaryExistingKeys_(sh, h);
    var nowIso = new Date().toISOString();
    var cutoff = Date.now() - hours * 60 * 60 * 1000;
    var html = OGZ_fetchUrlText_(sourceUrl);
    var listing = OGZ_parseOzarkCountyTimesObitListing_(html, sourceUrl).slice(0, maxItems);
    var imported = [], updated = [], skippedOld = 0, skippedUnknownDate = 0, skippedExisting = 0, errors = [];
    for (var i=0; i<listing.length; i++) {
      var entry = listing[i];
      try {
        var detail = {};
        if (entry.source_url) {
          try { detail = OGZ_parseObituaryDetail_(OGZ_fetchUrlText_(entry.source_url), entry.source_url, entry); }
          catch(detailErr) { detail = {}; errors.push({ url:entry.source_url, error:String(detailErr && detailErr.message || detailErr) }); }
        }
        var merged = OGZ_mergeObjects_(entry, detail);
        var sourceTs = OGZ_time_(merged.source_published_at || merged.published_at);
        if (!sourceTs && !includeUnknownDates) { skippedUnknownDate++; continue; }
        if (sourceTs && sourceTs < cutoff) { skippedOld++; continue; }
        merged.imported_at = merged.imported_at || nowIso;
        merged.last_seen_at = nowIso;
        merged.status = merged.status || "published";
        if (!merged.published_at) merged.published_at = merged.source_published_at || nowIso;
        if (!merged.updated_at) merged.updated_at = nowIso;
        if (!merged.image_url) merged.image_url = OGZ_OBITUARY_DEFAULT_IMAGE;
        if (!merged.image_credit) merged.image_credit = merged.image_url === OGZ_OBITUARY_DEFAULT_IMAGE ? "The Ozark Gazette" : "Source";
        var key = OGZ_obituaryKey_(merged);
        var existingRow = existing[key];
        if (existingRow) {
          OGZ_updateObituarySeen_(sh, h, existingRow, merged);
          updated.push({ name:merged.name, source_url:merged.source_url });
          skippedExisting++;
        } else {
          OGZ_appendObituary_(sh, h, merged);
          imported.push({ name:merged.name, source_url:merged.source_url, source_published_at:merged.source_published_at });
          existing[key] = sh.getLastRow();
        }
      } catch (rowErr) {
        errors.push({ title:entry.name || entry.title || "", error:String(rowErr && rowErr.message || rowErr) });
      }
    }
    return { success:true, source_url:sourceUrl, hours:hours, include_unknown_dates:includeUnknownDates, scanned:listing.length, imported:imported.length, updated:updated.length, skipped_old:skippedOld, skipped_unknown_date:skippedUnknownDate, skipped_existing:skippedExisting, imported_items:imported, updated_items:updated, errors:errors };
  } finally { lock.releaseLock(); }
}

function OGZ_obituaryExistingKeys_(sh, h) {
  var rows = sh.getDataRange().getValues();
  var existing = {};
  for (var i=1; i<rows.length; i++) {
    var o = OGZ_rowToObituary_(rows[i], h);
    var key = OGZ_obituaryKey_(o);
    if (key) existing[key] = i+1;
  }
  return existing;
}

function OGZ_obituaryKey_(obit) {
  if (obit.source_url) return "url:" + String(obit.source_url).toLowerCase();
  if (obit.obit_id) return "id:" + String(obit.obit_id).toLowerCase();
  return "slug:" + String(obit.slug || OGZ_slugify_(obit.name)).toLowerCase();
}

function OGZ_appendObituary_(sh, h, obit) {
  if (!obit.obit_id) obit.obit_id = "obit-" + OGZ_shortHash_(obit.source_url || obit.name || new Date().toISOString());
  if (!obit.slug) obit.slug = OGZ_slugify_(obit.name);
  var row = new Array(sh.getLastColumn()).fill("");
  OGZ_OBITUARY_HEADERS.forEach(function(name){
    if (h[name] !== undefined) row[h[name]] = obit[name] || "";
  });
  sh.appendRow(row);
}

function OGZ_updateObituarySeen_(sh, h, rowNumber, obit) {
  if (h.last_seen_at !== undefined) sh.getRange(rowNumber, h.last_seen_at + 1).setValue(obit.last_seen_at || new Date().toISOString());
  var fields = ["source_published_at","published_at","updated_at","summary","body_html","image_url","image_credit","date_of_death","service_date","location","age","status"];
  fields.forEach(function(name){
    if (h[name] !== undefined && obit[name]) sh.getRange(rowNumber, h[name] + 1).setValue(obit[name]);
  });
}

function OGZ_fetchUrlText_(url) {
  var res = UrlFetchApp.fetch(url, {
    method:"get",
    muteHttpExceptions:true,
    followRedirects:true,
    headers:{
      "User-Agent":"Mozilla/5.0 (compatible; OzarkGazetteBot/1.0; +https://ozarks.cgnnews.net)",
      "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  var code = res.getResponseCode();
  if (code < 200 || code >= 400) throw new Error("Fetch failed " + code + " for " + url);
  return res.getContentText();
}

function OGZ_parseOzarkCountyTimesObitListing_(html, baseUrl) {
  var out = [];
  var re = /<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>([\s\S]*?)(?=<h2\b|<ul[^>]*class=["'][^"']*pager|<nav\b|<aside\b|<footer\b|$)/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var href = OGZ_absoluteUrl_(m[1], baseUrl);
    var title = OGZ_cleanText_(m[2]);
    if (!title || /^pages$/i.test(title) || out.length >= 50) continue;
    var after = m[3] || "";
    var summary = OGZ_cleanText_(after).replace(/\s*(Pages|Search|Weather|Most Viewed|Recent Posts)\s*$/i, "").slice(0, 500);
    var nameAge = OGZ_parseNameAge_(title);
    out.push({
      obit_id:"obit-" + OGZ_shortHash_(href || title),
      name:nameAge.name,
      age:nameAge.age,
      slug:OGZ_slugify_(nameAge.name),
      source_name:"Ozark County Times",
      source_url:href,
      source_published_at:"",
      published_at:"",
      updated_at:"",
      date_of_death:OGZ_extractDeathDate_(summary),
      service_date:OGZ_extractServiceDate_(summary),
      location:OGZ_extractLocation_(summary),
      summary:summary,
      body_html:summary ? "<p>" + OGZ_escapeHtml_(summary) + "</p>" : "",
      image_url:OGZ_OBITUARY_DEFAULT_IMAGE,
      image_credit:"The Ozark Gazette",
      imported_at:"",
      last_seen_at:"",
      status:"published"
    });
  }
  return out;
}

function OGZ_parseObituaryDetail_(html, url, listing) {
  listing = listing || {};
  var title = OGZ_meta_(html, "og:title") || OGZ_title_(html) || listing.name || "";
  title = title.replace(/\s*\|\s*Ozark County Times\s*$/i, "").trim();
  var nameAge = OGZ_parseNameAge_(title);
  var published = OGZ_meta_(html, "article:published_time") || OGZ_meta_(html, "datePublished") || OGZ_firstTimeDatetime_(html) || OGZ_findLabeledDate_(html);
  if (published) published = OGZ_toIsoDate_(published);
  var bodyHtml = OGZ_extractBodyHtml_(html);
  var text = OGZ_cleanText_(bodyHtml) || listing.summary || "";
  var image = OGZ_meta_(html, "og:image") || OGZ_meta_(html, "twitter:image") || "";
  image = OGZ_isUsableObitImage_(image) ? OGZ_absoluteUrl_(image, url) : "";
  return {
    obit_id:listing.obit_id || ("obit-" + OGZ_shortHash_(url || title)),
    name:nameAge.name || listing.name,
    age:nameAge.age || listing.age,
    slug:OGZ_slugify_(nameAge.name || listing.name),
    source_name:"Ozark County Times",
    source_url:url,
    source_published_at:published || listing.source_published_at || "",
    published_at:published || listing.published_at || "",
    updated_at:new Date().toISOString(),
    date_of_death:OGZ_extractDeathDate_(text) || listing.date_of_death || "",
    service_date:OGZ_extractServiceDate_(text) || listing.service_date || "",
    location:OGZ_extractLocation_(text) || listing.location || "",
    summary:(text || listing.summary || "").slice(0, 420),
    body_html:bodyHtml || listing.body_html || "",
    image_url:image || listing.image_url || OGZ_OBITUARY_DEFAULT_IMAGE,
    image_credit:image ? "Ozark County Times" : (listing.image_credit || "The Ozark Gazette"),
    status:"published"
  };
}

function OGZ_parseNameAge_(title) {
  var clean = OGZ_cleanText_(title).replace(/\s+/g, " ").trim();
  var m = clean.match(/^(.+?),\s*(\d{1,3})\s*$/);
  if (m) return { name:m[1].trim(), age:m[2] };
  return { name:clean, age:"" };
}

function OGZ_meta_(html, prop) {
  html = String(html || "");
  var escaped = String(prop || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var patterns = [
    new RegExp("<meta[^>]+property=[\\\"']" + escaped + "[\\\"'][^>]+content=[\\\"']([^\\\"']+)[\\\"'][^>]*>", "i"),
    new RegExp("<meta[^>]+name=[\\\"']" + escaped + "[\\\"'][^>]+content=[\\\"']([^\\\"']+)[\\\"'][^>]*>", "i"),
    new RegExp("<meta[^>]+content=[\\\"']([^\\\"']+)[\\\"'][^>]+property=[\\\"']" + escaped + "[\\\"'][^>]*>", "i"),
    new RegExp("<meta[^>]+content=[\\\"']([^\\\"']+)[\\\"'][^>]+name=[\\\"']" + escaped + "[\\\"'][^>]*>", "i")
  ];
  for (var i=0; i<patterns.length; i++) {
    var m = html.match(patterns[i]);
    if (m && m[1]) return OGZ_decodeEntities_(m[1]);
  }
  return "";
}
function OGZ_title_(html) {
  var m = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? OGZ_cleanText_(m[1]) : "";
}

function OGZ_firstTimeDatetime_(html) {
  var m = String(html || "").match(/<time[^>]+datetime=["']([^"']+)["'][^>]*>/i);
  return m ? OGZ_decodeEntities_(m[1]) : "";
}

function OGZ_findLabeledDate_(html) {
  var text = OGZ_cleanText_(html);
  var m = text.match(/(?:Published|Posted|Submitted|Updated)\s*(?:on|:)?\s*([A-Z][a-z]+\.?\s+\d{1,2},\s+\d{4})/);
  if (m) return m[1];
  return "";
}

function OGZ_extractBodyHtml_(html) {
  var patterns = [
    /<div[^>]+class=["'][^"']*(?:field-name-body|node__content|article-content|content|body)[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>)?/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i
  ];
  for (var i=0; i<patterns.length; i++) {
    var m = String(html || "").match(patterns[i]);
    if (m && m[1]) {
      var cleaned = OGZ_sanitizeHtml_(m[1]);
      if (OGZ_cleanText_(cleaned).length > 50) return cleaned;
    }
  }
  return "";
}

function OGZ_sanitizeHtml_(html) {
  var s = String(html || "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/\s(on\w+)=["'][^"']*["']/gi, "");
  return s.trim();
}

function OGZ_cleanText_(html) {
  return OGZ_decodeEntities_(String(html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function OGZ_decodeEntities_(s) {
  return String(s || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&mdash;/g, "-")
    .replace(/&ndash;/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
function OGZ_escapeHtml_(s) {
  return String(s || "").replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c];});
}

function OGZ_absoluteUrl_(href, baseUrl) {
  href = OGZ_safe_(href).trim();
  if (!href) return "";
  if (/^https?:\/\//i.test(href)) return href;
  var origin = String(baseUrl || OGZ_OBITUARIES_SOURCE_URL).match(/^https?:\/\/[^\/]+/i);
  origin = origin ? origin[0] : "https://www.ozarkcountytimes.com";
  if (href.charAt(0) === "/") return origin + href;
  return origin + "/" + href.replace(/^\.?\//, "");
}

function OGZ_isUsableObitImage_(url) {
  var s = String(url || "").toLowerCase();
  if (!s) return false;
  if (s.indexOf("logo") !== -1 || s.indexOf("favicon") !== -1 || s.indexOf("sprite") !== -1) return false;
  return /\.(png|jpe?g|webp)(\?|$)/i.test(s) || s.indexOf("/sites/") !== -1;
}

function OGZ_extractDeathDate_(text) {
  var s = OGZ_cleanText_(text);
  var m = s.match(/\b(?:died|passed away|died peacefully|entered.*?rest)\s+(?:on\s+)?((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?[,]?\s*(?:Jan\.?|January|Feb\.?|February|Mar\.?|March|Apr\.?|April|May|Jun\.?|June|Jul\.?|July|Aug\.?|August|Sep\.?|Sept\.?|September|Oct\.?|October|Nov\.?|November|Dec\.?|December)\s+\d{1,2}(?:,\s*\d{4})?)/i);
  return m ? OGZ_toIsoDate_(m[1]) : "";
}

function OGZ_extractServiceDate_(text) {
  var s = OGZ_cleanText_(text);
  var m = s.match(/\b(?:service|services|memorial service|funeral services|graveside services)[^\.]{0,120}?\b(?:at|on|held|will be held)?\s*((?:\d{1,2}\s*(?:a\.m\.|p\.m\.)[,]?\s*)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?[,]?\s*(?:Jan\.?|January|Feb\.?|February|Mar\.?|March|Apr\.?|April|May|Jun\.?|June|Jul\.?|July|Aug\.?|August|Sep\.?|Sept\.?|September|Oct\.?|October|Nov\.?|November|Dec\.?|December)\s+\d{1,2}(?:,\s*\d{4})?)/i);
  return m ? m[1].trim() : "";
}

function OGZ_extractLocation_(text) {
  var s = OGZ_cleanText_(text);
  var m = s.match(/\bof\s+([A-Z][A-Za-z .'-]+?)(?:,|\s+died|\s+passed|\s+will|\s+were|\s+was)/);
  return m ? m[1].trim() : "";
}

function OGZ_toIsoDate_(value) {
  var s = OGZ_safe_(value).replace(/,/g, ", ").replace(/\s+/g, " ").trim();
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  return "";
}

function OGZ_shortHash_(value) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ""), Utilities.Charset.UTF_8);
  return bytes.map(function(b){ var v=(b<0?b+256:b).toString(16); return v.length===1 ? "0"+v : v; }).join("").slice(0,16);
}

function OGZ_mergeObjects_(a,b) {
  var out = {};
  var k;
  a = a || {}; b = b || {};
  for (k in a) if (a.hasOwnProperty(k)) out[k] = a[k];
  for (k in b) if (b.hasOwnProperty(k) && b[k] !== "" && b[k] !== null && b[k] !== undefined) out[k] = b[k];
  return out;
}

function OGZ_createObituariesTrigger_() {
  OGZ_deleteObituariesTrigger_();
  ScriptApp.newTrigger("OGZ_obituariesHourlyJob").timeBased().everyHours(1).create();
  return OGZ_obituariesTriggerStatus_();
}

function OGZ_deleteObituariesTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function(t){ if (t.getHandlerFunction() === "OGZ_obituariesHourlyJob") ScriptApp.deleteTrigger(t); });
  return { success:true, deleted:true, handler:"OGZ_obituariesHourlyJob" };
}

function OGZ_obituariesTriggerStatus_() {
  var list = ScriptApp.getProjectTriggers().filter(function(t){ return t.getHandlerFunction() === "OGZ_obituariesHourlyJob"; });
  return { success:true, active:list.length>0, count:list.length, handler:"OGZ_obituariesHourlyJob" };
}

function OGZ_obituariesHourlyJob(){ return OGZ_syncObituaries_({ hours:24, max:20 }); }


function OGZ_sourceRegistry_(){ return { success:true, sources:{ obituaries:OGZ_obituarySources_().sources, courts:OGZ_courtSources_().sources, traffic:OGZ_trafficSources_().sources, weather:OGZ_weatherSources_().sources } }; }
function OGZ_obituarySources_(){ return { success:true, sources:[
  { name:"Ozark County Times Obituaries", url:"https://ozarkcountytimes.com/obituaries", use:"Secondary local obituary monitoring and duplicate checks" },
  { name:"Robertson-Drago Funeral Home Obituaries", url:"https://www.robertsondrago.com/obituaries", use:"Regional funeral-home obituary monitoring when geographically relevant" }
]};}
function OGZ_courtSources_(){ return { success:true, sources:[
  { name:"Missouri Case.net", url:"https://www.courts.mo.gov/cnet/welcome.do", use:"Official Missouri court records search" },
  { name:"Missouri Courts", url:"https://www.courts.mo.gov/", use:"Official court system source" },
  { name:"Ozark County Times Court News", url:"https://ozarkcountytimes.com/", use:"Secondary local context, not source of record" }
]};}
function OGZ_trafficSources_(){ return { success:true, sources:[
  { name:"MoDOT Traveler Information", url:"https://traveler.modot.org/", use:"Traffic incidents, closures and road conditions" },
  { name:"Missouri State Highway Patrol crash reports", url:"https://www.mshp.dps.missouri.gov/HP68/search.jsp", use:"Crash reports and public safety records where available" }
]};}
function OGZ_weatherSources_(){ return { success:true, sources:[
  { name:"National Weather Service Springfield", url:"https://www.weather.gov/sgf/", use:"Official forecast office and alerts" },
  { name:"NWS Radar", url:"https://radar.weather.gov/", use:"Official radar" },
  { name:"Open-Meteo", url:"https://open-meteo.com/", use:"Structured current forecast data for website widgets" }
]};}

/*
  Integration note for existing CGN doGet/doPost router:
  after payload is normalized and before the default route response, add:

  var ozarkResponse = ozarkGazetteRoute_(payload);
  if (ozarkResponse) return jsonOutput_(ozarkResponse);

  If the existing JSON helper has a different name, return the object through the project’s standard JSON output helper.
*/

// ============================================================
// The Ozark Gazette AutoNews22 — single dispatcher + Articles publishing
// Build: 2026-06-30
// Purpose: Daily Traffic Brief 05:00 CT, Daily Weather Brief 06:00 CT,
// hourly Severe Weather Alert checks, Sports Brief 17:00 CT, all from one
// installable timer. Publishes only to the Ozarks Articles sheet.
// ============================================================

var OGZ_AUTONEWS22_VERSION = "ozark-autonews22-single-dispatcher-2026-06-30";
var OGZ_AUTONEWS22_ENABLED_KEY = "OGZ_AUTONEWS22_ENABLED";
var OGZ_AUTONEWS22_TRIGGER_MODE_KEY = "OGZ_AUTONEWS22_TRIGGER_MODE";
var OGZ_AUTONEWS22_LAST_DISPATCH_KEY = "OGZ_AUTONEWS22_LAST_DISPATCH";
var OGZ_AUTONEWS22_LAST_PREFIX = "OGZ_AUTONEWS22_LAST_RUN_";
var OGZ_AUTONEWS22_LAST_ALERT_SIGNATURE_KEY = "OGZ_AUTONEWS22_LAST_ALERT_SIGNATURE";
var OGZ_AUTONEWS22_LAST_ENABLE_ERROR_KEY = "OGZ_AUTONEWS22_LAST_ENABLE_ERROR";
var OGZ_AUTONEWS22_DISPATCHER_HANDLER = "OGZ_AutoNews22Dispatcher";
var OGZ_AUTONEWS22_TIMEZONE = "America/Chicago";
var OGZ_AUTONEWS22_DISPATCH_INTERVAL_MINUTES = 5;
var OGZ_AUTONEWS22_DUE_WINDOW_MINUTES = 45;
var OGZ_AUTONEWS22_LATITUDE = 36.5836;
var OGZ_AUTONEWS22_LONGITUDE = -92.2863;
var OGZ_AUTONEWS22_PLACE = "Ozark County";
var OGZ_AUTONEWS22_DATELINE = "GAINESVILLE";
var OGZ_AUTONEWS22_WEATHER_OFFICE_URL = "https://www.weather.gov/sgf/";
var OGZ_AUTONEWS22_NWS_POINTS_URL = "https://api.weather.gov/points/" + OGZ_AUTONEWS22_LATITUDE + "," + OGZ_AUTONEWS22_LONGITUDE;
var OGZ_AUTONEWS22_NWS_ALERTS_URL = "https://api.weather.gov/alerts/active?point=" + OGZ_AUTONEWS22_LATITUDE + "," + OGZ_AUTONEWS22_LONGITUDE;

var OGZ_AUTONEWS22_IMAGE_GENERAL = "https://media.cgnnews.net/affiliates/StLouis01.png";
var OGZ_AUTONEWS22_IMAGE_SPORTS = "https://www.cgnnews.net/sports/CGNStockSportsImage01.webp";
var OGZ_AUTONEWS22_IMAGE_WEATHER = "https://www.cgnnews.net/weather/CGNStockWeatherImage01.webp";
var OGZ_AUTONEWS22_IMAGE_TRAFFIC = "https://www.cgnnews.net/traffic/CGNTrafficAdvisory01.png";
var OGZ_AUTONEWS22_IMAGE_SEVERE = "https://www.cgnnews.net/CGNSevereWeather02.png";

var OGZ_AUTONEWS22_CREDIT_GENERAL = "CGN News / Cook Global News Network / St. Louis Affiliate Image / All Rights Reserved";
var OGZ_AUTONEWS22_CREDIT_SPORTS = "CGN News / Cook Global News Network / Sports Category Image / All Rights Reserved";
var OGZ_AUTONEWS22_CREDIT_WEATHER = "CGN News / Cook Global News Network / CGN Weather Brief / All Rights Reserved";
var OGZ_AUTONEWS22_CREDIT_TRAFFIC = "CGN News / Cook Global News Network / CGN Traffic Advisory / All Rights Reserved";
var OGZ_AUTONEWS22_CREDIT_SEVERE = "CGN News / Cook Global News Network / CGN Severe Weather Brief / All Rights Reserved";

var OGZ_AUTONEWS22_AUTHORS = {
  editor:"Michael A. Cook",
  general:"Jordan Whitaker",
  traffic:"Jordan Whitaker",
  weather:"Elise Navarro",
  severe:"Elise Navarro",
  sports:"Marcus Bell"
};

var OGZ_ARTICLE_HEADERS = [
  "article_id",
  "title",
  "subtitle",
  "slug",
  "category",
  "tags",
  "author",
  "published_at",
  "updated_at",
  "summary",
  "body_html",
  "what_this_means",
  "hero_image_url",
  "image_credit",
  "inline_images",
  "featured",
  "breaking",
  "views",
  "status",
  "seo_title",
  "seo_description",
  "display_order"
];

function OGZ_AutoNews22IsEnabled_(){
  return PropertiesService.getScriptProperties().getProperty(OGZ_AUTONEWS22_ENABLED_KEY) === "TRUE";
}

function OGZ_AutoNews22LastRunKey_(taskKey){
  return OGZ_AUTONEWS22_LAST_PREFIX + String(taskKey || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function OGZ_AutoNews22Schedule_(){
  return [
    { task_key:"traffic_brief", label:"Ozark Traffic Brief", hour:5, minute:0, handler:"OGZ_AutoNews22PublishTrafficBrief_", cadence:"daily" },
    { task_key:"daily_weather", label:"Daily Weather Brief", hour:6, minute:0, handler:"OGZ_AutoNews22PublishDailyWeatherBrief_", cadence:"daily" },
    { task_key:"severe_weather", label:"Severe Weather Alert check", minute:0, handler:"OGZ_AutoNews22SevereWeatherCheck", cadence:"hourly" },
    { task_key:"sports_brief", label:"Ozark Sports Brief", hour:17, minute:0, handler:"OGZ_AutoNews22PublishSportsBrief_", cadence:"daily" }
  ];
}

function OGZ_AutoNews22Handlers_(){
  return [OGZ_AUTONEWS22_DISPATCHER_HANDLER, "OGZ_AutoNews22PublishTrafficBrief_", "OGZ_AutoNews22PublishDailyWeatherBrief_", "OGZ_AutoNews22SevereWeatherCheck", "OGZ_AutoNews22PublishSportsBrief_", "OGZ_AutoNews22TrafficBriefRun", "OGZ_AutoNews22DailyWeatherRun", "OGZ_AutoNews22SportsBriefRun"];
}

function OGZ_AutoNews22Enable(){
  var props = PropertiesService.getScriptProperties();
  var deleted = OGZ_AutoNews22DeleteTriggers_();
  try {
    ScriptApp.newTrigger(OGZ_AUTONEWS22_DISPATCHER_HANDLER).timeBased().everyMinutes(OGZ_AUTONEWS22_DISPATCH_INTERVAL_MINUTES).create();
    props.setProperty(OGZ_AUTONEWS22_ENABLED_KEY, "TRUE");
    props.setProperty(OGZ_AUTONEWS22_TRIGGER_MODE_KEY, "single_dispatcher_every_" + OGZ_AUTONEWS22_DISPATCH_INTERVAL_MINUTES + "_minutes");
    props.deleteProperty(OGZ_AUTONEWS22_LAST_ENABLE_ERROR_KEY);
    return OGZ_AutoNews22Status_({ enabled_now:true, deleted_existing_triggers:deleted });
  } catch(err) {
    props.setProperty(OGZ_AUTONEWS22_ENABLED_KEY, "FALSE");
    props.setProperty(OGZ_AUTONEWS22_TRIGGER_MODE_KEY, "enable_failed_no_trigger_created");
    props.setProperty(OGZ_AUTONEWS22_LAST_ENABLE_ERROR_KEY, String(err && err.message ? err.message : err));
    var st = OGZ_AutoNews22Status_({ enable_failed:true, deleted_existing_triggers:deleted });
    st.success = false;
    st.error = String(err && err.message ? err.message : err);
    st.note = "AutoNews22 uses one dispatcher trigger. Delete obsolete project triggers if Apps Script reports no trigger capacity.";
    return st;
  }
}

function OGZ_AutoNews22Disable(){
  var deleted = OGZ_AutoNews22DeleteTriggers_();
  PropertiesService.getScriptProperties().setProperty(OGZ_AUTONEWS22_ENABLED_KEY, "FALSE");
  return OGZ_AutoNews22Status_({ disabled_now:true, deleted_existing_triggers:deleted });
}

function OGZ_AutoNews22DeleteTriggers_(){
  var handlers = OGZ_AutoNews22Handlers_();
  var deleted = 0;
  ScriptApp.getProjectTriggers().forEach(function(t){
    var h = String(t.getHandlerFunction && t.getHandlerFunction() || "");
    if (handlers.indexOf(h) !== -1) {
      ScriptApp.deleteTrigger(t);
      deleted++;
    }
  });
  return deleted;
}

function OGZ_AutoNews22Status(){
  return OGZ_AutoNews22Status_({});
}

function OGZ_AutoNews22Status_(extra){
  extra = extra || {};
  var props = PropertiesService.getScriptProperties();
  var handlers = OGZ_AutoNews22Handlers_();
  var active = [];
  var allTriggers = ScriptApp.getProjectTriggers();
  allTriggers.forEach(function(t){
    var h = String(t.getHandlerFunction && t.getHandlerFunction() || "");
    if (handlers.indexOf(h) !== -1) {
      active.push({ handler:h, event_type:String(t.getEventType ? t.getEventType() : ""), source:String(t.getTriggerSource ? t.getTriggerSource() : "") });
    }
  });
  var last = {};
  OGZ_AutoNews22Schedule_().forEach(function(s){
    last[s.task_key] = props.getProperty(OGZ_AutoNews22LastRunKey_(s.task_key)) || "";
  });
  var out = {
    success:true,
    site:"ozark",
    version:OGZ_AUTONEWS22_VERSION,
    enabled:OGZ_AutoNews22IsEnabled_(),
    timezone:OGZ_AUTONEWS22_TIMEZONE,
    trigger_mode:props.getProperty(OGZ_AUTONEWS22_TRIGGER_MODE_KEY) || "single_dispatcher_every_" + OGZ_AUTONEWS22_DISPATCH_INTERVAL_MINUTES + "_minutes",
    dispatcher_handler:OGZ_AUTONEWS22_DISPATCHER_HANDLER,
    dispatcher_interval_minutes:OGZ_AUTONEWS22_DISPATCH_INTERVAL_MINUTES,
    due_window_minutes:OGZ_AUTONEWS22_DUE_WINDOW_MINUTES,
    project_trigger_count:allTriggers.length,
    autonews_trigger_count:active.length,
    dispatcher_trigger_count:active.filter(function(t){ return t.handler === OGZ_AUTONEWS22_DISPATCHER_HANDLER; }).length,
    triggers:active,
    schedule:OGZ_AutoNews22Schedule_().map(function(s){
      return {
        task_key:s.task_key,
        label:s.label,
        cadence:s.cadence,
        central_time:s.cadence === "hourly" ? "hourly near minute " + OGZ_pad2_(s.minute || 0) : OGZ_pad2_(s.hour) + ":" + OGZ_pad2_(s.minute || 0),
        handler:s.handler
      };
    }),
    last_dispatch:props.getProperty(OGZ_AUTONEWS22_LAST_DISPATCH_KEY) || "",
    last_enable_error:props.getProperty(OGZ_AUTONEWS22_LAST_ENABLE_ERROR_KEY) || "",
    last_alert_signature:props.getProperty(OGZ_AUTONEWS22_LAST_ALERT_SIGNATURE_KEY) || "",
    last_runs:last,
    image_rules:{
      default_general:OGZ_AUTONEWS22_IMAGE_GENERAL,
      sports:OGZ_AUTONEWS22_IMAGE_SPORTS,
      weather:OGZ_AUTONEWS22_IMAGE_WEATHER,
      traffic:OGZ_AUTONEWS22_IMAGE_TRAFFIC,
      severe_weather_alert:OGZ_AUTONEWS22_IMAGE_SEVERE
    },
    authors:OGZ_AUTONEWS22_AUTHORS
  };
  Object.keys(extra).forEach(function(k){ out[k] = extra[k]; });
  return out;
}

function OGZ_AutoNews22Dispatcher(options){
  options = options || {};
  if (!OGZ_AutoNews22IsEnabled_() && !options.force) {
    return { success:false, enabled:false, dispatcher:true, version:OGZ_AUTONEWS22_VERSION, error:"Ozark AutoNews22 is disabled." };
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    return { success:false, skipped:true, dispatcher:true, reason:"ozark_autonews22_dispatcher_lock_unavailable", version:OGZ_AUTONEWS22_VERSION };
  }
  try {
    var now = OGZ_AutoNews22LocalNow_(new Date());
    var due = OGZ_AutoNews22DueSchedule_(now, options);
    var results = [];
    due.forEach(function(s){
      results.push(OGZ_AutoNews22RunScheduledItem_(s, { dispatcher:true, force:!!options.force, local_now:now }));
    });
    PropertiesService.getScriptProperties().setProperty(OGZ_AUTONEWS22_LAST_DISPATCH_KEY, new Date().toISOString());
    return {
      success:true,
      site:"ozark",
      version:OGZ_AUTONEWS22_VERSION,
      dispatcher:true,
      trigger_mode:"single_dispatcher_every_" + OGZ_AUTONEWS22_DISPATCH_INTERVAL_MINUTES + "_minutes",
      timezone:OGZ_AUTONEWS22_TIMEZONE,
      local_date:now.date_key,
      local_time:now.time_hhmm,
      due:due.length,
      results:results,
      schedule:OGZ_AutoNews22Schedule_()
    };
  } catch(err) {
    return { success:false, site:"ozark", version:OGZ_AUTONEWS22_VERSION, dispatcher:true, error:String(err && err.message ? err.message : err) };
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

function OGZ_AutoNews22DueSchedule_(now, options){
  options = options || {};
  var due = [];
  var schedule = OGZ_AutoNews22Schedule_();
  schedule.forEach(function(s){
    var shouldRun = false;
    var runKey = s.task_key;
    if (options.force_task && String(options.force_task) !== s.task_key) return;
    if (options.force) {
      shouldRun = true;
    } else if (s.cadence === "hourly") {
      var targetMinute = Number(s.minute || 0);
      var distance = Math.abs(Number(now.minute) - targetMinute);
      if (distance <= OGZ_AUTONEWS22_DUE_WINDOW_MINUTES) {
        runKey = s.task_key + "_" + now.date_key + "_" + OGZ_pad2_(now.hour);
        shouldRun = !OGZ_AutoNews22AlreadyRan_(runKey);
      }
    } else {
      var target = Number(s.hour) * 60 + Number(s.minute || 0);
      var current = Number(now.hour) * 60 + Number(now.minute);
      var late = current - target;
      if (late >= 0 && late <= OGZ_AUTONEWS22_DUE_WINDOW_MINUTES) {
        runKey = s.task_key + "_" + now.date_key;
        shouldRun = !OGZ_AutoNews22AlreadyRan_(runKey);
      }
    }
    if (shouldRun) {
      var copy = {};
      Object.keys(s).forEach(function(k){ copy[k] = s[k]; });
      copy.run_key = runKey;
      due.push(copy);
    }
  });
  return due;
}

function OGZ_AutoNews22RunScheduledItem_(s, options){
  options = options || {};
  var result;
  if (s.task_key === "traffic_brief") result = OGZ_AutoNews22PublishTrafficBrief_({ scheduled:true });
  else if (s.task_key === "daily_weather") result = OGZ_AutoNews22PublishDailyWeatherBrief_({ scheduled:true });
  else if (s.task_key === "severe_weather") result = OGZ_AutoNews22SevereWeatherCheck({ scheduled:true });
  else if (s.task_key === "sports_brief") result = OGZ_AutoNews22PublishSportsBrief_({ scheduled:true });
  else result = { success:false, skipped:true, reason:"unknown_task", task_key:s.task_key };
  if (result && result.success !== false && !result.error && s.run_key) OGZ_AutoNews22MarkRan_(s.run_key);
  return result;
}

function OGZ_AutoNews22AlreadyRan_(runKey){
  return !!PropertiesService.getScriptProperties().getProperty(OGZ_AutoNews22LastRunKey_(runKey));
}

function OGZ_AutoNews22MarkRan_(runKey){
  PropertiesService.getScriptProperties().setProperty(OGZ_AutoNews22LastRunKey_(runKey), new Date().toISOString());
}

function OGZ_AutoNews22LocalNow_(date){
  date = date || new Date();
  var tz = OGZ_AUTONEWS22_TIMEZONE;
  return {
    date:date,
    date_key:Utilities.formatDate(date, tz, "yyyy-MM-dd"),
    hour:Number(Utilities.formatDate(date, tz, "H")),
    minute:Number(Utilities.formatDate(date, tz, "m")),
    hour_key:Utilities.formatDate(date, tz, "yyyy-MM-dd-HH"),
    time_hhmm:Utilities.formatDate(date, tz, "HH:mm"),
    visible_date:Utilities.formatDate(date, tz, "d MMMM yyyy"),
    visible_date_us:Utilities.formatDate(date, tz, "MMMM d, yyyy"),
    iso:date.toISOString()
  };
}

function OGZ_AutoNews22LocalDateTime_(value){
  var d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return Utilities.formatDate(d, OGZ_AUTONEWS22_TIMEZONE, "d MMMM yyyy 'at' h:mm a z");
}

function OGZ_AutoNews22ArticleId_(prefix){
  return "ogz-" + Utilities.formatDate(new Date(), "UTC", "yyyyMMdd-HHmmss") + "-" + String(prefix || "autonews22").replace(/[^a-z0-9]+/gi, "").toLowerCase().slice(0, 12) + "-" + Utilities.getUuid().replace(/-/g, "").slice(0, 6);
}

function OGZ_AutoNews22ImageForArticle_(category, subtype){
  category = String(category || "").toLowerCase();
  subtype = String(subtype || "").toLowerCase();
  if (subtype === "severe" || subtype === "severe_weather_alert") return OGZ_AUTONEWS22_IMAGE_SEVERE;
  if (category === "sports") return OGZ_AUTONEWS22_IMAGE_SPORTS;
  if (category === "weather") return OGZ_AUTONEWS22_IMAGE_WEATHER;
  if (category === "traffic") return OGZ_AUTONEWS22_IMAGE_TRAFFIC;
  return OGZ_AUTONEWS22_IMAGE_GENERAL;
}

function OGZ_AutoNews22CreditForArticle_(category, subtype){
  category = String(category || "").toLowerCase();
  subtype = String(subtype || "").toLowerCase();
  if (subtype === "severe" || subtype === "severe_weather_alert") return OGZ_AUTONEWS22_CREDIT_SEVERE;
  if (category === "sports") return OGZ_AUTONEWS22_CREDIT_SPORTS;
  if (category === "weather") return OGZ_AUTONEWS22_CREDIT_WEATHER;
  if (category === "traffic") return OGZ_AUTONEWS22_CREDIT_TRAFFIC;
  return OGZ_AUTONEWS22_CREDIT_GENERAL;
}

function OGZ_ensureArticlesSheet_(){
  var ss = OGZ_ss_();
  var sh = ss.getSheetByName(OGZ_ARTICLES_SHEET);
  if (!sh) sh = ss.insertSheet(OGZ_ARTICLES_SHEET);
  if (sh.getLastRow() < 1 || sh.getLastColumn() < 1 || String(sh.getRange(1,1).getValue() || "").trim() === "") {
    sh.clear();
    sh.getRange(1, 1, 1, OGZ_ARTICLE_HEADERS.length).setValues([OGZ_ARTICLE_HEADERS]);
    sh.setFrozenRows(1);
    return sh;
  }
  var h = OGZ_headerMap_(sh);
  var missing = [];
  OGZ_ARTICLE_HEADERS.forEach(function(name){
    if (h[name] === undefined) missing.push(name);
  });
  if (missing.length) {
    sh.getRange(1, sh.getLastColumn() + 1, 1, missing.length).setValues([missing]);
  }
  sh.setFrozenRows(1);
  return sh;
}

function OGZ_appendArticleToArticles_(article, options){
  options = options || {};
  var sh = OGZ_ensureArticlesSheet_();
  var h = OGZ_headerMap_(sh);
  var rows = sh.getDataRange().getValues();
  var slug = String(article.slug || OGZ_slugify_(article.title || "")).trim();
  for (var i = 1; i < rows.length; i++) {
    var existingSlug = OGZ_safe_(OGZ_get_(rows[i], h, "slug"));
    var existingId = OGZ_safe_(OGZ_get_(rows[i], h, "article_id"));
    if ((slug && existingSlug === slug) || (article.article_id && existingId === article.article_id)) {
      return { success:true, saved:false, duplicate:true, sheet:OGZ_ARTICLES_SHEET, row:i+1, article_id:existingId || article.article_id, slug:existingSlug || slug, title:OGZ_safe_(OGZ_get_(rows[i], h, "title")), status:OGZ_safe_(OGZ_get_(rows[i], h, "status")) || "published" };
    }
  }
  var row = new Array(sh.getLastColumn()).fill("");
  Object.keys(article).forEach(function(name){
    if (h[name] !== undefined) row[h[name]] = article[name];
  });
  sh.appendRow(row);
  return { success:true, saved:true, duplicate:false, sheet:OGZ_ARTICLES_SHEET, row:sh.getLastRow(), article_id:article.article_id, slug:slug, title:article.title, status:article.status || "published" };
}

function OGZ_AutoNews22ArticleBase_(fields){
  fields = fields || {};
  var now = new Date();
  var category = fields.category || "Local";
  var subtype = fields.subtype || "";
  var title = fields.title || "Ozark Gazette Update";
  var article = {
    article_id:fields.article_id || OGZ_AutoNews22ArticleId_(fields.id_prefix || "autonews22"),
    title:title,
    subtitle:fields.subtitle || fields.summary || "",
    slug:fields.slug || OGZ_slugify_(title + " " + Utilities.formatDate(now, "UTC", "yyyy-MM-dd-HH-mm-ss")),
    category:category,
    tags:fields.tags || category + ", The Ozark Gazette",
    author:fields.author || OGZ_AUTONEWS22_AUTHORS.general,
    published_at:fields.published_at || now.toISOString(),
    updated_at:fields.updated_at || fields.published_at || now.toISOString(),
    summary:fields.summary || fields.subtitle || "",
    body_html:fields.body_html || "",
    what_this_means:fields.what_this_means || "",
    hero_image_url:fields.hero_image_url || OGZ_AutoNews22ImageForArticle_(category, subtype),
    image_credit:fields.image_credit || OGZ_AutoNews22CreditForArticle_(category, subtype),
    inline_images:fields.inline_images || "TRUE",
    featured:fields.featured || "FALSE",
    breaking:fields.breaking || "FALSE",
    views:fields.views === undefined ? 10 : fields.views,
    status:fields.status || "published",
    seo_title:fields.seo_title || title,
    seo_description:fields.seo_description || fields.summary || fields.subtitle || ""
  };
  if (fields.display_order !== undefined) article.display_order = fields.display_order;
  return article;
}

function OGZ_AutoNews22SourceLinksHtml_(sources){
  sources = sources || [];
  return sources.map(function(s){
    return '<a href="' + OGZ_escapeHtml_(s.url) + '" target="_blank" rel="noopener noreferrer">' + OGZ_escapeHtml_(s.label) + '</a>';
  }).join("; ");
}

function OGZ_AutoNews22FetchJson_(url){
  var res = UrlFetchApp.fetch(url, {
    method:"get",
    muteHttpExceptions:true,
    followRedirects:true,
    headers:{
      "User-Agent":"The Ozark Gazette AutoNews22 (tips@cgnnews.net)",
      "Accept":"application/geo+json, application/json"
    }
  });
  var code = res.getResponseCode();
  if (code < 200 || code >= 400) throw new Error("Fetch failed " + code + " for " + url);
  return JSON.parse(res.getContentText());
}

function OGZ_AutoNews22WeatherForecast_(){
  var points = OGZ_AutoNews22FetchJson_(OGZ_AUTONEWS22_NWS_POINTS_URL);
  var forecastUrl = points && points.properties && points.properties.forecast;
  if (!forecastUrl) throw new Error("NWS point response did not include forecast URL.");
  var forecast = OGZ_AutoNews22FetchJson_(forecastUrl);
  var periods = forecast && forecast.properties && forecast.properties.periods || [];
  if (!periods.length) throw new Error("NWS forecast returned no periods.");
  return {
    point:points,
    forecast:forecast,
    periods:periods,
    today:periods[0] || {},
    tonight:periods[1] || {},
    forecast_url:forecastUrl
  };
}

function OGZ_AutoNews22PublishDailyWeatherBrief_(payload){
  payload = payload || {};
  var stamp = payload.published_at ? new Date(payload.published_at) : new Date();
  var local = OGZ_AutoNews22LocalNow_(stamp);
  var forecast = OGZ_AutoNews22WeatherForecast_();
  var today = forecast.today || {};
  var tonight = forecast.tonight || {};
  var todayName = today.name || "Today";
  var tonightName = tonight.name || "Tonight";
  var tempLine = today.temperature !== undefined && today.temperature !== "" ? String(today.temperature) + "°" + (today.temperatureUnit || "F") : "temperatures from the latest National Weather Service forecast";
  var tonightLine = tonight.temperature !== undefined && tonight.temperature !== "" ? String(tonight.temperature) + "°" + (tonight.temperatureUnit || "F") : "the latest listed overnight forecast";
  var shortForecast = today.shortForecast || "official forecast conditions";
  var title = "Daily Weather Brief for " + local.visible_date + ": Ozark County Conditions and Planning Notes";
  var subtitle = "The National Weather Service forecast for " + OGZ_AUTONEWS22_PLACE + " calls for " + shortForecast + ", with " + tempLine + " during " + todayName + ".";
  var summary = OGZ_AUTONEWS22_PLACE + ": " + shortForecast + ", " + tempLine + " for " + todayName + "; " + tonightName + " near " + tonightLine + ". Source: National Weather Service and NOAA.";
  var sources = [
    { label:"National Weather Service", url:forecast.forecast_url },
    { label:"NOAA", url:"https://www.noaa.gov/" },
    { label:"National Weather Service Springfield", url:OGZ_AUTONEWS22_WEATHER_OFFICE_URL }
  ];
  var body = [];
  body.push('<p><strong>' + OGZ_AUTONEWS22_DATELINE + ' |</strong> Ozark County readers should plan around the latest National Weather Service forecast for ' + OGZ_escapeHtml_(local.visible_date) + '. The current official planning snapshot lists <strong>' + OGZ_escapeHtml_(shortForecast) + '</strong> for ' + OGZ_escapeHtml_(todayName) + ', with ' + OGZ_escapeHtml_(tempLine) + '.</p>');
  body.push('<h2>What the forecast shows</h2>');
  body.push('<p>' + OGZ_escapeHtml_(todayName) + ': ' + OGZ_escapeHtml_(today.detailedForecast || shortForecast || "The latest National Weather Service forecast should guide daily planning.") + '</p>');
  if (tonight.name || tonight.detailedForecast) body.push('<p>' + OGZ_escapeHtml_(tonightName) + ': ' + OGZ_escapeHtml_(tonight.detailedForecast || ("The overnight forecast lists " + tonightLine + ".")) + '</p>');
  body.push('<h2>Why it matters</h2><p>Weather coverage is public-service coverage. This brief is a planning snapshot for travel, school activities, outdoor work, farm chores, lake plans, youth sports and community events across Tecumseh, Gainesville, Theodosia, Dora, Hardenville and the surrounding Ozark County area.</p>');
  body.push('<p>Conditions can vary by ridge, valley, creek crossing, lake area and road segment. Readers should check current National Weather Service alerts before changing travel, work, school, event or outdoor plans.</p>');
  body.push('<h2>What remains uncertain</h2><p>The forecast may change as new observations arrive. Thunderstorms, heat, fog, flooding, winter weather, wind and road conditions can change faster than a morning article. This brief does not replace current warnings, advisories, local emergency guidance or instructions from public-safety officials.</p>');
  body.push('<h2>What to watch next</h2><p>Watch for updated National Weather Service forecast discussions, active alerts, radar trends, creek and low-water crossing conditions, school or event notices, and MoDOT road information if weather affects travel.</p>');
  body.push('<p><strong>Additional Reporting By:</strong> ' + OGZ_AutoNews22SourceLinksHtml_(sources) + '</p>');
  var article = OGZ_AutoNews22ArticleBase_({
    id_prefix:"weather",
    title:title,
    subtitle:subtitle,
    slug:OGZ_slugify(title),
    category:"Weather",
    tags:"Weather, Daily Weather Brief, Ozark County, Tecumseh, Gainesville, National Weather Service, NOAA",
    author:OGZ_AUTONEWS22_AUTHORS.weather,
    published_at:stamp.toISOString(),
    updated_at:stamp.toISOString(),
    summary:summary,
    body_html:body.join(""),
    what_this_means:"<p>Use this weather brief as a planning snapshot and check current National Weather Service alerts before travel, outdoor work, school activities, lake plans or public events.</p><p>Newer official alerts, cancellations or local emergency instructions should control immediate safety decisions.</p>",
    subtype:"daily_weather",
    hero_image_url:OGZ_AUTONEWS22_IMAGE_WEATHER,
    image_credit:OGZ_AUTONEWS22_CREDIT_WEATHER,
    seo_title:title,
    seo_description:summary
  });
  var saved = OGZ_appendArticleToArticles_(article, {});
  return { success:true, task:"daily_weather", scheduled_central_time:"06:00", saved:saved.saved, duplicate:saved.duplicate, article_id:saved.article_id, title:saved.title, slug:saved.slug, image_url:article.hero_image_url, author:article.author, source_url:forecast.forecast_url };
}

function OGZ_AutoNews22TrafficSources_(){
  return [
    { label:"MoDOT Traveler Information Map", url:"https://traveler.modot.org/map/" },
    { label:"MoDOT Road Conditions", url:"https://www.modot.org/gatewayguide/road-conditions" },
    { label:"Missouri State Highway Patrol crash reports", url:"https://www.mshp.dps.missouri.gov/HP68/search.jsp" }
  ];
}

function OGZ_AutoNews22PublishTrafficBrief_(payload){
  payload = payload || {};
  var stamp = payload.published_at ? new Date(payload.published_at) : new Date();
  var local = OGZ_AutoNews22LocalNow_(stamp);
  var title = "Ozark Traffic Brief for " + local.visible_date + ": Tecumseh, Gainesville and Ozark County Road Watch";
  var subtitle = "The Ozark Gazette is watching official road-condition, crash, work-zone, flooding and travel information for Ozark County before the morning drive.";
  var summary = "A daily Ozark traffic planning brief focused on US 160, MO 5, county routes, low-water crossings, work zones, crashes, flooding and official MoDOT travel information.";
  var sources = OGZ_AutoNews22TrafficSources_();
  var body = [];
  body.push('<p><strong>' + OGZ_AUTONEWS22_DATELINE + ' |</strong> The Ozark Gazette is publishing the ' + OGZ_escapeHtml_(local.visible_date) + ' morning traffic brief as a planning tool for Tecumseh, Gainesville, Theodosia, Dora, Hardenville and the surrounding Ozark County area.</p>');
  body.push('<h2>What is being monitored</h2>');
  body.push('<p>CGN Traffic Center is watching official road-condition categories, crash reports, work zones, flooding reports, closures, message-board notices and travel updates before readers begin the day. The highest-priority local corridors include US 160, MO 5, approaches into Gainesville, lake-area roads, county routes and low-water crossings that can change quickly during heavy rain.</p>');
  body.push('<p>This article is not reporting a specific emergency closure unless one is stated directly and attributed to an official source. Drivers should check current MoDOT information before departure if the route, weather or timing matters.</p>');
  body.push('<h2>Why it matters</h2><p>Ozark County travel is sensitive to weather, distance, curves, hills, farm traffic, school traffic, emergency response, work zones and creek crossings. A short delay or closure on a rural route can require a long detour, especially for school, work, medical appointments or supply trips.</p>');
  body.push('<h2>Reader safety note</h2><p>Do not use traffic maps, camera pages, mobile apps or advisory pages while driving. Check conditions before departure, ask a passenger to review official sources or pull over safely before using a phone or map.</p>');
  body.push('<h2>What to watch next</h2><p>Watch for MoDOT road-condition updates, Missouri State Highway Patrol crash records, local emergency-management information, school transportation notices and weather alerts that may affect roads.</p>');
  body.push('<p><strong>Additional Reporting By:</strong> ' + OGZ_AutoNews22SourceLinksHtml_(sources) + '</p>');
  var article = OGZ_AutoNews22ArticleBase_({
    id_prefix:"traffic",
    title:title,
    subtitle:subtitle,
    slug:OGZ_slugify(title),
    category:"Traffic",
    tags:"Traffic, Ozark Traffic Brief, Ozark County, Tecumseh, Gainesville, MoDOT, Missouri State Highway Patrol, road conditions, work zones, flooding",
    author:OGZ_AUTONEWS22_AUTHORS.traffic,
    published_at:stamp.toISOString(),
    updated_at:stamp.toISOString(),
    summary:summary,
    body_html:body.join(""),
    what_this_means:"<p>The Ozark Traffic Brief is a daily planning tool. It highlights official transportation sources and local corridors to check before travel without inventing unverified closures or crash details.</p><p>Drivers should rely on current MoDOT, law-enforcement and emergency-management information before departure.</p>",
    subtype:"traffic",
    hero_image_url:OGZ_AUTONEWS22_IMAGE_TRAFFIC,
    image_credit:OGZ_AUTONEWS22_CREDIT_TRAFFIC,
    seo_title:title,
    seo_description:summary
  });
  var saved = OGZ_appendArticleToArticles_(article, {});
  return { success:true, task:"traffic_brief", scheduled_central_time:"05:00", saved:saved.saved, duplicate:saved.duplicate, article_id:saved.article_id, title:saved.title, slug:saved.slug, image_url:article.hero_image_url, author:article.author };
}

function OGZ_AutoNews22SportsSources_(){
  return [
    { label:"Missouri State High School Activities Association", url:"https://www.mshsaa.org/" },
    { label:"Ozark County Times", url:"https://www.ozarkcountytimes.com/sports" },
    { label:"The Ozark Gazette Sports", url:OGZ_SITE_URL + "/sports/" }
  ];
}

function OGZ_AutoNews22PublishSportsBrief_(payload){
  payload = payload || {};
  var stamp = payload.published_at ? new Date(payload.published_at) : new Date();
  var local = OGZ_AutoNews22LocalNow_(stamp);
  var title = "Ozark Sports Brief for " + local.visible_date + ": Local Games, Recreation and Planning Notes";
  var subtitle = "The Ozark Gazette sports desk is watching school athletics, recreation, outdoor activity and official sports updates across Ozark County.";
  var summary = "A daily Ozark sports planning brief for school athletics, recreation, outdoor activity, trail use, lake-area plans and official schedule or results updates.";
  var sources = OGZ_AutoNews22SportsSources_();
  var body = [];
  body.push('<p><strong>' + OGZ_AUTONEWS22_DATELINE + ' |</strong> The Ozark Gazette sports desk is publishing the ' + OGZ_escapeHtml_(local.visible_date) + ' sports brief for readers following school athletics, recreation, outdoor activity and community sports planning across Ozark County.</p>');
  body.push('<h2>What the desk is watching</h2><p>The sports desk is watching official school athletics updates, MSHSAA information, recreation notices, lake-area conditions, youth sports, community fitness events and local outdoor activity. This brief does not report a score, injury, lineup change or schedule change unless that detail is supported by an official source or credited local report.</p>');
  body.push('<h2>Why it matters</h2><p>Sports coverage in the Ozarks includes more than final scores. School schedules, recreation access, trails, lake conditions, heat, storms, travel distance and community events all affect how readers plan practices, games, family outings and outdoor exercise.</p>');
  body.push('<h2>What to watch next</h2><p>Readers should check official school and association pages for final schedules, cancellations, playoff information, eligibility updates and results. Weather and traffic should also be checked before evening travel or outdoor activity.</p>');
  body.push('<p><strong>Additional Reporting By:</strong> ' + OGZ_AutoNews22SourceLinksHtml_(sources) + '</p>');
  var article = OGZ_AutoNews22ArticleBase_({
    id_prefix:"sports",
    title:title,
    subtitle:subtitle,
    slug:OGZ_slugify(title),
    category:"Sports",
    tags:"Sports, Ozark Sports Brief, Ozark County, school athletics, recreation, MSHSAA, outdoor activity",
    author:OGZ_AUTONEWS22_AUTHORS.sports,
    published_at:stamp.toISOString(),
    updated_at:stamp.toISOString(),
    summary:summary,
    body_html:body.join(""),
    what_this_means:"<p>Use this sports brief as a planning snapshot and verify schedules, results, cancellations and official records with school, association or event sources before travel.</p>",
    subtype:"sports",
    hero_image_url:OGZ_AUTONEWS22_IMAGE_SPORTS,
    image_credit:OGZ_AUTONEWS22_CREDIT_SPORTS,
    seo_title:title,
    seo_description:summary
  });
  var saved = OGZ_appendArticleToArticles_(article, {});
  return { success:true, task:"sports_brief", scheduled_central_time:"17:00", saved:saved.saved, duplicate:saved.duplicate, article_id:saved.article_id, title:saved.title, slug:saved.slug, image_url:article.hero_image_url, author:article.author };
}

function OGZ_AutoNews22SevereWeatherCheck(payload){
  payload = payload || {};
  var data = OGZ_AutoNews22FetchJson_(OGZ_AUTONEWS22_NWS_ALERTS_URL);
  var features = data && data.features || [];
  if (!features.length) {
    return { success:true, task:"severe_weather", checked:true, published:false, skipped:true, reason:"no_active_nws_alerts_for_point", alert_count:0, source_url:OGZ_AUTONEWS22_NWS_ALERTS_URL };
  }
  features.sort(function(a,b){
    return OGZ_AutoNews22AlertPriority_(b) - OGZ_AutoNews22AlertPriority_(a);
  });
  var alert = features[0];
  var p = alert.properties || {};
  var signature = OGZ_AutoNews22AlertSignature_(alert);
  var props = PropertiesService.getScriptProperties();
  var last = props.getProperty(OGZ_AUTONEWS22_LAST_ALERT_SIGNATURE_KEY) || "";
  if (last === signature && !payload.force) {
    return { success:true, task:"severe_weather", checked:true, published:false, skipped:true, reason:"same_alert_signature_already_published", alert_count:features.length, event:p.event || "", signature:signature, source_url:OGZ_AUTONEWS22_NWS_ALERTS_URL };
  }
  var article = OGZ_AutoNews22BuildSevereWeatherArticle_(alert, features, signature);
  var saved = OGZ_appendArticleToArticles_(article, {});
  props.setProperty(OGZ_AUTONEWS22_LAST_ALERT_SIGNATURE_KEY, signature);
  return { success:true, task:"severe_weather", checked:true, published:!!saved.saved, saved:saved.saved, duplicate:saved.duplicate, alert_count:features.length, event:p.event || "", signature:signature, article_id:saved.article_id, title:saved.title, slug:saved.slug, image_url:article.hero_image_url, author:article.author };
}

function OGZ_AutoNews22AlertPriority_(feature){
  var p = feature && feature.properties || {};
  var event = String(p.event || "").toLowerCase();
  var severity = String(p.severity || "").toLowerCase();
  var score = 0;
  if (severity === "extreme") score += 400;
  else if (severity === "severe") score += 300;
  else if (severity === "moderate") score += 200;
  else if (severity === "minor") score += 100;
  if (/tornado|flash flood|severe thunderstorm|extreme heat|ice storm|winter storm|blizzard/.test(event)) score += 50;
  return score;
}

function OGZ_AutoNews22AlertSignature_(feature){
  var p = feature && feature.properties || {};
  var raw = [feature.id || p.id || "", p.event || "", p.effective || "", p.ends || p.expires || "", p.areaDesc || ""].join("|");
  return OGZ_shortHash_(raw);
}

function OGZ_AutoNews22BuildSevereWeatherArticle_(alert, allFeatures, signature){
  var p = alert.properties || {};
  var now = new Date();
  var local = OGZ_AutoNews22LocalNow_(now);
  var event = p.event || "Weather Alert";
  var area = p.areaDesc || OGZ_AUTONEWS22_PLACE;
  var title = "Severe Weather Alert: " + event + " for Ozark County";
  var subtitle = "An official National Weather Service " + event + " is active for Ozark County; readers should monitor current alerts and local emergency guidance.";
  var summary = "An active National Weather Service " + event + " is affecting Ozark County. Severity: " + (p.severity || "not listed") + ". Source: National Weather Service and NOAA.";
  var sources = [
    { label:"National Weather Service", url:"https://www.weather.gov/" },
    { label:"NOAA", url:"https://www.noaa.gov/" },
    { label:"National Weather Service Springfield", url:OGZ_AUTONEWS22_WEATHER_OFFICE_URL },
    { label:"NWS active alerts API", url:OGZ_AUTONEWS22_NWS_ALERTS_URL }
  ];
  var body = [];
  body.push('<p><strong>' + OGZ_AUTONEWS22_DATELINE + ' |</strong> An official National Weather Service <strong>' + OGZ_escapeHtml_(event) + '</strong> is active for Ozark County. This is a public-safety planning alert, not a substitute for live emergency instructions, and readers should keep checking official alerts because warnings, advisories and statements can change quickly.</p>');
  body.push('<h2>What is active now</h2>');
  body.push('<p>The primary active alert is <strong>' + OGZ_escapeHtml_(event) + '</strong>. NWS lists severity as ' + OGZ_escapeHtml_(p.severity || "not listed") + ', urgency as ' + OGZ_escapeHtml_(p.urgency || "not listed") + ' and certainty as ' + OGZ_escapeHtml_(p.certainty || "not listed") + '.</p>');
  if (p.effective || p.ends || p.expires) {
    body.push('<p>The alert became effective ' + OGZ_escapeHtml_(OGZ_AutoNews22LocalDateTime_(p.effective) || "at the time listed by NWS") + '. The current listed ending or expiration time is ' + OGZ_escapeHtml_(OGZ_AutoNews22LocalDateTime_(p.ends || p.expires) || "not listed") + '.</p>');
  }
  body.push('<p><strong>Affected area listed by NWS:</strong> ' + OGZ_escapeHtml_(area) + '</p>');
  if (allFeatures.length > 1) {
    body.push('<h2>Other active alerts in the point response</h2><ul>');
    allFeatures.slice(0, 5).forEach(function(f){
      var fp = f.properties || {};
      body.push('<li><strong>' + OGZ_escapeHtml_(fp.event || "Weather Alert") + ':</strong> ' + OGZ_escapeHtml_(fp.areaDesc || OGZ_AUTONEWS22_PLACE) + '</li>');
    });
    body.push('</ul>');
  }
  body.push('<h2>Safety guidance</h2>');
  if (p.instruction) body.push('<p>' + OGZ_escapeHtml_(p.instruction) + '</p>');
  else body.push('<p>Follow National Weather Service instructions, keep alerts enabled, avoid flooded roads, limit outdoor exposure during dangerous heat, seek sturdy shelter during severe thunderstorms or tornado warnings, and follow local emergency-management guidance if conditions deteriorate.</p>');
  if (p.description) {
    body.push('<h2>NWS alert details</h2><p>' + OGZ_escapeHtml_(p.description).replace(/\n+/g, "</p><p>") + '</p>');
  }
  body.push('<h2>What to watch next</h2><p>This alert should be updated if the National Weather Service issues, cancels, extends or replaces the active product. Conditions can vary by county, road segment, creek crossing and neighborhood.</p>');
  body.push('<p><strong>Additional Reporting By:</strong> ' + OGZ_AutoNews22SourceLinksHtml_(sources) + '</p>');
  return OGZ_AutoNews22ArticleBase_({
    id_prefix:"swa",
    title:title,
    subtitle:subtitle,
    slug:OGZ_slugify(title + " " + signature + " " + local.date_key),
    category:"Weather",
    tags:"Weather, Severe Weather Alert, " + event + ", National Weather Service, NOAA, Ozark County, alert_signature:" + signature,
    author:OGZ_AUTONEWS22_AUTHORS.severe,
    published_at:now.toISOString(),
    updated_at:now.toISOString(),
    summary:summary,
    body_html:body.join(""),
    what_this_means:"<p>An official National Weather Service alert is active for Ozark County. Readers should monitor current NWS alerts and local emergency information before travel, outdoor work, school activities, lake plans or public events.</p><p>County-specific warnings, advisories, cancellations or emergency instructions should guide immediate decisions.</p>",
    subtype:"severe",
    hero_image_url:OGZ_AUTONEWS22_IMAGE_SEVERE,
    image_credit:OGZ_AUTONEWS22_CREDIT_SEVERE,
    featured:"TRUE",
    breaking:"TRUE",
    seo_title:title,
    seo_description:subtitle
  });
}

function OGZ_AutoNews22PublishGeneralFromPayload_(payload){
  payload = payload || {};
  var category = payload.category || "Local";
  var title = OGZ_safe_(payload.title || "").trim();
  if (!title) return { success:false, error:"Missing title" };
  var subtitle = OGZ_safe_(payload.subtitle || payload.summary || "").trim();
  var body = OGZ_safe_(payload.body_html || "").trim();
  if (!body && payload.body) body = "<p>" + OGZ_escapeHtml_(payload.body) + "</p>";
  if (!body) return { success:false, error:"Missing body_html or body" };
  var author = OGZ_safe_(payload.author || "").trim();
  if (!author) author = OGZ_AUTONEWS22_AUTHORS.general;
  if (author !== OGZ_AUTONEWS22_AUTHORS.editor && author !== OGZ_AUTONEWS22_AUTHORS.general) author = OGZ_AUTONEWS22_AUTHORS.general;
  var article = OGZ_AutoNews22ArticleBase_({
    id_prefix:"manual",
    title:title,
    subtitle:subtitle,
    slug:payload.slug || OGZ_slugify_(title),
    category:category,
    tags:payload.tags || category + ", Ozark County, The Ozark Gazette",
    author:author,
    published_at:payload.published_at || new Date().toISOString(),
    updated_at:payload.updated_at || payload.published_at || new Date().toISOString(),
    summary:payload.summary || subtitle,
    body_html:body,
    what_this_means:payload.what_this_means || "",
    subtype:payload.subtype || "",
    hero_image_url:payload.hero_image_url || OGZ_AutoNews22ImageForArticle_(category, payload.subtype || ""),
    image_credit:payload.image_credit || OGZ_AutoNews22CreditForArticle_(category, payload.subtype || ""),
    featured:payload.featured || "FALSE",
    breaking:payload.breaking || "FALSE",
    seo_title:payload.seo_title || title,
    seo_description:payload.seo_description || payload.summary || subtitle
  });
  var saved = OGZ_appendArticleToArticles_(article, {});
  return { success:true, task:"general_payload_publish", saved:saved.saved, duplicate:saved.duplicate, article_id:saved.article_id, title:saved.title, slug:saved.slug, image_url:article.hero_image_url, author:article.author, category:article.category };
}

// Convenience direct-run buttons for Apps Script editor.
function OGZ_AutoNews22TrafficBriefRun(){ return OGZ_AutoNews22PublishTrafficBrief_({ manual:true }); }
function OGZ_AutoNews22DailyWeatherRun(){ return OGZ_AutoNews22PublishDailyWeatherBrief_({ manual:true }); }
function OGZ_AutoNews22SportsBriefRun(){ return OGZ_AutoNews22PublishSportsBrief_({ manual:true }); }

