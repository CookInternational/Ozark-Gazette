
/**
 * The Ozark Gazette backend extension for the CGN Apps Script project.
 * Site: https://ozarks.cgnnews.net
 * Sheet: 1Xz9bnMqb-tkHeo2N2UonUbBr1jpo1VzKcVbBW_PU2n0
 * Tabs: Articles, Archives
 * Add this file to the existing CGN Apps Script project as a separate .gs file.
 */
var OGZ_SPREADSHEET_ID = "1Xz9bnMqb-tkHeo2N2UonUbBr1jpo1VzKcVbBW_PU2n0";
var OGZ_SITE_URL = "https://ozarks.cgnnews.net";
var OGZ_ARTICLES_SHEET = "Articles";
var OGZ_ARCHIVES_SHEET = "Archives";
var OGZ_ARCHIVE_AFTER_HOURS = 168;
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
  return { success:false, error:"Unknown Ozark Gazette action", action:action };
}

function OGZ_health_() {
  return { success:true, site:"The Ozark Gazette", url:OGZ_SITE_URL, spreadsheet_id:OGZ_SPREADSHEET_ID, sheets:[OGZ_ARTICLES_SHEET, OGZ_ARCHIVES_SHEET], checked_at:new Date().toISOString() };
}

function OGZ_ss_(){ return SpreadsheetApp.openById(OGZ_SPREADSHEET_ID); }
function OGZ_sheet_(name){ var sh=OGZ_ss_().getSheetByName(name); if(!sh) throw new Error("Missing sheet: "+name); return sh; }
function OGZ_headerMap_(sheet){ var headers=sheet.getRange(1,1,1,Math.max(1,sheet.getLastColumn())).getValues()[0]; var m={}; headers.forEach(function(h,i){ m[String(h||"").trim()] = i; }); return m; }
function OGZ_get_(row,h,name){ return h[name] === undefined ? "" : row[h[name]]; }
function OGZ_safe_(v){ return v === null || v === undefined ? "" : String(v); }
function OGZ_bool_(v){ return v === true || String(v).toLowerCase() === "true" || String(v) === "1"; }
function OGZ_slugify_(v){ return String(v||"").toLowerCase().replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-").replace(/-+/g,"-").replace(/^-+|-+$/g,""); }
function OGZ_time_(v){ var d=new Date(v); return isNaN(d.getTime()) ? 0 : d.getTime(); }

function OGZ_rowToArticle_(row,h,source) {
  var title = OGZ_safe_(OGZ_get_(row,h,"title"));
  var slug = OGZ_safe_(OGZ_get_(row,h,"slug")) || OGZ_slugify_(title);
  var published = OGZ_get_(row,h,"published_at") || OGZ_get_(row,h,"updated_at") || "";
  var d = OGZ_time_(published) ? new Date(published) : new Date();
  var y = d.getUTCFullYear();
  var m = String(d.getUTCMonth()+1).padStart(2,"0");
  var day = String(d.getUTCDate()).padStart(2,"0");
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
