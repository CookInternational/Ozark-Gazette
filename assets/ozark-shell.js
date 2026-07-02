(function(){
  "use strict";

  const API_BASE = "https://script.google.com/macros/s/AKfycbx41mQg-Ine3XZ-VrMI_SaQn4_K6cDQHA0cBFyGPgupu_edNFoNRjSLv2hoSe_bOytt/exec";
  const SITE = "ozark";
  const DEFAULT_IMG = "/OzarkGazetteBanner.png";
  const OZARK_SHEET_ID = "1Xz9bnMqb-tkHeo2N2UonUbBr1jpo1VzKcVbBW_PU2n0";
  const OZARK_SHEETS = { articles:"Articles", archives:"Archives", obituaries:"Obituaries" };
  const OZARK_BUREAU_ROTATION_MS = 7000;
  const OZARK_BUREAU_WEATHER_REFRESH_MS = 10 * 60 * 1000;

  const OZARK_BUREAU_CITIES = [
    {
      name:"Tecumseh",
      location:"Tecumseh, MO",
      latitude:36.5867,
      longitude:-92.2867,
      timeZone:"America/Chicago"
    },
    {
      name:"Gainesville",
      location:"Gainesville, MO",
      latitude:36.60306,
      longitude:-92.42833,
      timeZone:"America/Chicago"
    },
    {
      name:"St. Louis",
      location:"St. Louis, MO",
      latitude:38.6270,
      longitude:-90.1994,
      timeZone:"America/Chicago"
    },
    {
      name:"Indianapolis",
      location:"Indianapolis, IN",
      latitude:39.7684,
      longitude:-86.1581,
      timeZone:"America/Indiana/Indianapolis"
    },
    {
      name:"Chicago",
      location:"Chicago, IL",
      latitude:41.8781,
      longitude:-87.6298,
      timeZone:"America/Chicago"
    },
    {
      name:"New York",
      location:"New York, NY",
      latitude:40.7128,
      longitude:-74.0060,
      timeZone:"America/New_York"
    },
    {
      name:"Philadelphia",
      location:"Philadelphia, PA",
      latitude:39.9526,
      longitude:-75.1652,
      timeZone:"America/New_York"
    },
    {
      name:"Baton Rouge",
      location:"Baton Rouge, LA",
      latitude:30.4515,
      longitude:-91.1871,
      timeZone:"America/Chicago"
    },
    {
      name:"Miami",
      location:"Miami, FL",
      latitude:25.7617,
      longitude:-80.1918,
      timeZone:"America/New_York"
    },
    {
      name:"Los Angeles",
      location:"Los Angeles, CA",
      latitude:34.0522,
      longitude:-118.2437,
      timeZone:"America/Los_Angeles"
    }
  ];

  window.CGN_API_BASE = API_BASE;
  window.CGN_API_URL = API_BASE;
  window.CGN_CONFIG = Object.assign(window.CGN_CONFIG || {}, {apiBase:API_BASE, site:SITE});

  let shellClockTimer = null;
  let shellWeatherTimer = null;
  let shellRotationTimer = null;
  let ozarkBureauIndex = 0;
  const ozarkBureauWeatherCache = {};

  function esc(v){
    return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  }

  function slugify(v){
    return String(v || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getUser(){
    return localStorage.getItem("user_id") || localStorage.getItem("cgn_user_id") || "";
  }

  function getAnonId(){
    let id = localStorage.getItem("ozark_anon_id") || localStorage.getItem("cgn_anon_id");
    if(!id){
      id = "ozark_anon_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("ozark_anon_id", id);
      localStorage.setItem("cgn_anon_id", id);
    }
    return id;
  }

  function applySubscriberState(data){
    data = data || {};
    const active = !!data.subscriber || !!data.active_subscriber || String(data.subscription_status || "").toLowerCase() === "active";
    if(active) localStorage.setItem("subscriber", "true");
    else localStorage.removeItem("subscriber");
    try{ localStorage.setItem("cgn_subscription", JSON.stringify(data)); }catch(e){}
    return active;
  }

  async function syncSubscriberState(userId){
    if(!userId) return null;
    try{
      const qs = new URLSearchParams({action:"subscription_status", user_id:userId});
      const res = await fetch(`${API_BASE}?${qs.toString()}`, {cache:"no-store"});
      const data = await res.json();
      if(data && data.success){
        applySubscriberState(data);
        return data;
      }
    }catch(e){
      console.warn("Ozark subscriber sync failed:", e);
    }
    return null;
  }

  function injectShellStyles(){
    if(document.getElementById("ozark-shell-responsive-styles")) return;
    const style = document.createElement("style");
    style.id = "ozark-shell-responsive-styles";
    style.textContent = `
      #cgn-site-header,#cgn-site-footer{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
      #cgn-site-header *,#cgn-site-footer *{box-sizing:border-box}
      .skip-link{position:absolute;left:-999px;top:auto;width:1px;height:1px;overflow:hidden}
      .skip-link:focus{left:12px;top:12px;width:auto;height:auto;z-index:9999;background:#fff;color:#07172f;padding:8px 10px;border:2px solid #07172f}
      .top-bar{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:10px 20px;background:#fff;color:#07172f;border-bottom:1px solid #dfe4eb;position:relative;z-index:20;overflow:visible}
      .brand-link{display:flex;align-items:center;gap:12px;color:#111;text-decoration:none;flex:0 0 auto;min-width:0}
      .brand-link .logo{height:82px;width:auto;max-width:290px;object-fit:contain;display:block;flex:0 1 auto}
      .brand-text{display:flex;flex-direction:column;gap:2px;min-width:0}
      .network-name{font:900 11px/1 Arial,Helvetica,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#07172f;white-space:normal}
      .brand-tagline{font:800 11px/1.2 Arial,Helvetica,sans-serif;color:#6b7280;white-space:normal}
      .nav{display:flex;align-items:center;justify-content:center;gap:16px;font-weight:800;white-space:nowrap;overflow:visible;min-width:0;flex-wrap:wrap}
      .nav a,.nav-more-button{border:0!important;background:transparent!important;color:#111!important;display:inline-flex;align-items:center;justify-content:center;min-height:0;padding:4px!important;text-decoration:none;font:900 14px/1 Arial,Helvetica,sans-serif!important;text-transform:none!important;letter-spacing:0!important;white-space:nowrap;cursor:pointer}
      .nav a:hover,.nav a:focus,.nav-more-button:hover,.nav-more-button:focus{text-decoration:underline!important;background:transparent!important;color:#111!important;outline-offset:3px}
      .nav-more{position:relative;display:inline-flex;align-items:center}
      .nav-dropdown{display:none;position:absolute;right:0;top:100%;min-width:230px;background:#fff;border:1px solid #dfe4eb;box-shadow:0 14px 34px rgba(7,23,47,.14);padding:8px 0;z-index:500;text-align:left}
      .nav-more.open .nav-dropdown,.nav-more:hover .nav-dropdown,.nav-more:focus-within .nav-dropdown{display:block}
      .nav-dropdown a{display:block!important;padding:10px 14px!important;font-size:13px!important;line-height:1.15!important;color:#111!important;text-decoration:none!important;justify-content:flex-start!important;width:100%}
      .nav-dropdown a:hover,.nav-dropdown a:focus{background:#f8fafc!important;text-decoration:none!important;color:#111!important}
      .right-tools{display:flex;align-items:center;justify-content:flex-end;gap:10px;white-space:nowrap;min-width:0;flex-wrap:wrap;overflow:visible}
      .account-wrap{position:relative;display:inline-flex;align-items:center;flex:0 0 auto}
      .account-wrap>a{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:8px 10px;border:1px solid #111;background:#fff;color:#111;border-radius:999px;text-decoration:none;font-weight:900;font-size:12px;line-height:1;white-space:nowrap}
      .account-wrap>a:hover,.account-wrap>a:focus{background:#111;color:#fff;text-decoration:none}
      .account-menu{display:none;position:absolute;right:0;top:calc(100% + 8px);min-width:150px;background:#fff;border:1px solid #dfe4eb;box-shadow:0 12px 30px rgba(0,0,0,.12);z-index:600;padding:8px 0}
      .account-menu.open{display:block}
      .account-menu a,.account-menu button{display:block;width:100%;box-sizing:border-box;text-align:left;border:0;background:#fff;color:#111;padding:9px 14px;font-size:13px;text-decoration:none;cursor:pointer}
      .account-menu a:hover,.account-menu button:hover{background:#f4f4f4}
      .cgn-bureau-weather-time{display:flex;flex-direction:column;text-decoration:none;color:#111;font-size:11px;line-height:1.25;font-weight:800;min-width:128px;max-width:190px;text-align:right;white-space:normal;overflow-wrap:anywhere}
      .cgn-bureau-weather-time span{display:block}
      .cgn-bureau-mobile-line,.cgn-mobile-weather-mini,.cgn-shell-compat-hidden{display:none!important}
      .cgn-bureau-time{font-size:11px;font-weight:800;color:#111;text-align:right}
      .cgn-bureau-weather{font-size:11px;font-weight:800;color:#111;text-align:right;display:block!important}
      .cgn-bureau-location{display:block!important;color:#c1121f;text-transform:uppercase;letter-spacing:.06em;font-size:10px;font-weight:900;text-align:right}
      .social-link,.support-link{width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #dfe4eb;border-radius:999px;background:#fff;color:#07172f;text-decoration:none;flex:0 0 auto;overflow:hidden}
      .social-link:hover,.support-link:hover,.social-link:focus,.support-link:focus{background:#07172f;color:#fff;text-decoration:none}
      .social-link svg{width:19px;height:19px;display:block;fill:currentColor}
      .support-link img{width:28px;height:28px;object-fit:contain;display:block}
      .news-directory-link,.sports-center-link,.traffic-center-link{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;color:#111;text-decoration:none;flex:0 0 auto;transition:opacity .2s ease}
      .news-directory-link:hover,.news-directory-link:focus,.sports-center-link:hover,.sports-center-link:focus,.traffic-center-link:hover,.traffic-center-link:focus{opacity:.72;text-decoration:none;color:#111;background:transparent}
      .news-directory-icon{width:28px;height:28px;display:inline-flex;flex-direction:column;align-items:center;justify-content:flex-start;position:relative;line-height:1}
      .news-directory-word{display:block;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:7px;font-weight:900;letter-spacing:.02em;color:#111;line-height:1;margin:0 0 1px}
      .news-directory-paper{width:23px;height:20px;display:block;position:relative;box-sizing:border-box;border:2px solid #111;border-radius:2px;background:#fff;box-shadow:inset 0 0 0 1px rgba(0,0,0,.05)}
      .news-directory-paper::before{content:"";position:absolute;left:3px;top:4px;width:7px;height:6px;background:#111;border-radius:1px}
      .news-directory-line{position:absolute;left:12px;right:3px;height:2px;background:#111;border-radius:999px}
      .news-directory-line-wide{left:3px;right:3px;top:12px}
      .news-directory-line:not(.news-directory-line-wide):nth-of-type(2){top:4px}
      .news-directory-line:not(.news-directory-line-wide):nth-of-type(3){top:8px}
      .news-directory-box{position:absolute;left:3px;right:3px;bottom:3px;height:2px;background:#111;border-radius:999px}
      .sports-center-icon,.traffic-center-icon{width:28px;height:28px;display:block;object-fit:contain}
      .right-tools .account-wrap{order:1}
      .right-tools .cgn-bureau-weather-time{order:2}
      .right-tools .news-directory-link{order:3}
      .right-tools .sports-center-link{order:4}
      .right-tools .traffic-center-link{order:5}
      .right-tools .cgn-help-link{order:6}
      .right-tools .social-instagram{order:7}
      .right-tools .social-x{order:8}
      .right-tools .social-youtube{order:9}
      .right-tools .cgn-ios-app-desktop-link{order:10}
      .right-tools .editor-portal-link{order:11}
      @keyframes ozarkHeadlineTickerScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
      .ticker{display:flex;align-items:center;gap:12px;min-height:40px;height:40px;padding:0 20px;background:#000;color:#fff;font-size:13px;font-weight:900;overflow:hidden;position:relative;isolation:isolate}
      .ticker-label{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;height:24px;padding:0 9px;border:1px solid rgba(242,217,144,.54);border-radius:999px;background:#c1121f;color:#fff;font-size:10px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;line-height:1;white-space:nowrap}
      .ticker-viewport{flex:1 1 auto;min-width:0;height:40px;display:flex;align-items:center;overflow:hidden;position:relative}
      .ticker-viewport:before,.ticker-viewport:after{content:"";position:absolute;top:0;bottom:0;width:34px;z-index:2;pointer-events:none}
      .ticker-viewport:before{left:0;background:linear-gradient(90deg,#000,rgba(0,0,0,0))}
      .ticker-viewport:after{right:0;background:linear-gradient(270deg,#000,rgba(0,0,0,0))}
      .ticker-track{display:inline-flex;align-items:center;white-space:nowrap;min-width:max-content;will-change:transform;animation:ozarkHeadlineTickerScroll 56s linear infinite}
      .ticker:hover .ticker-track,.ticker:focus-within .ticker-track{animation-play-state:paused}
      .ticker-group{display:inline-flex;align-items:center;white-space:nowrap;flex:0 0 auto}
      .ticker-item{display:inline-flex;align-items:center;white-space:nowrap;flex:0 0 auto;line-height:1}
      .ticker-item:after{content:"•";display:inline-block;margin:0 18px;color:#f2d990;opacity:.9}
      .ticker a{color:#fff;text-decoration:none;line-height:1;display:inline-block;white-space:nowrap;max-width:none}
      .ticker a:hover,.ticker a:focus{color:#f2d990;text-decoration:underline;text-underline-offset:3px}
      @media(prefers-reduced-motion:reduce){.ticker-track{animation:none}.ticker-viewport{overflow-x:auto;scrollbar-width:none}.ticker-viewport::-webkit-scrollbar{display:none}}
      .market-ticker-wrap{position:relative;background:#020711;color:#fff;border-top:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12);overflow:hidden;min-height:46px}
      .market-ticker-click{position:absolute;inset:0;z-index:3;display:block;text-indent:-9999px;color:#f2d990;text-decoration:none;font-size:12px;font-weight:900;text-transform:uppercase}
      .market-ticker-live{max-width:1180px;margin:0 auto;padding:0 20px;min-height:46px;display:flex;align-items:center;gap:10px;overflow:hidden}
      .market-ticker-label{padding:5px 8px;border:1px solid rgba(214,178,94,.48);border-radius:999px;background:rgba(7,17,31,.92);color:#f2d990;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;flex:0 0 auto}
      .market-tv-ticker{flex:1;height:46px;overflow:hidden;min-width:0}
      .market-tv-ticker .tradingview-widget-container,.market-tv-ticker .tradingview-widget-container__widget{height:46px!important;min-height:46px!important;overflow:hidden}
      .footer{background:#07172f;color:#fff;margin-top:36px}
      .footer a{color:#fff;text-decoration:none}
      .footer a:hover{text-decoration:underline}
      .footer-container{max-width:1180px;margin:0 auto;padding:28px 18px;display:grid;grid-template-columns:1.4fr repeat(4,minmax(0,1fr));gap:22px}
      .footer h4{margin:0 0 10px;color:#f2d990;text-transform:uppercase;letter-spacing:.08em;font-size:12px}
      .footer p{margin:0 0 10px;color:#dbe4f0;line-height:1.5;font-size:13px}
      .footer a{line-height:1.9;font-size:13px}
      .footer-cgn-logo-link{display:inline-flex;align-items:center;text-decoration:none;color:#fff;margin:0 0 8px}
      .footer-cgn-mark{width:132px;max-width:100%;height:auto;display:block}
      .cgn-tag{font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#fff!important}
      .footer-bottom{border-top:1px solid rgba(255,255,255,.16);text-align:center;padding:12px 18px 14px;color:#dbe4f0}
      .footer-bottom a{font-size:12px;color:#dbe4f0}
      .footer-developed{margin-top:5px;text-align:center;color:#dbe4f0;font-size:12px;font-weight:800;line-height:1.5}
      .footer-developed a{color:#f2d990;font-size:12px;font-weight:900;line-height:1.5}
      .footer-social{display:flex;align-items:center;gap:12px;margin-top:10px}
      .footer-social a{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;color:#fff;text-decoration:none;line-height:1!important;transition:opacity .2s ease}
      .footer-social a:hover,.footer-social a:focus{opacity:.72;text-decoration:none}
      .footer .social-icon{width:20px;height:20px;display:block;fill:#fff}
      .footer-veteran-owned-block{max-width:1180px;margin:0 auto;text-align:center;padding:0 18px 10px;color:#fff}
      .footer-veteran-owned-link{display:inline-flex;align-items:center;justify-content:center;color:#fff!important;text-decoration:none!important;font-size:12px!important;font-weight:900!important;letter-spacing:.08em;text-transform:uppercase;line-height:1.4!important}
      .footer-veteran-owned-link:hover,.footer-veteran-owned-link:focus{text-decoration:underline!important}

      .footer-support-advertise{color:#f2d990!important;font-weight:900}
      .footer-support-advertise:hover,.footer-support-advertise:focus{color:#fff!important;text-decoration:underline}
      .cgn-shell-login-modal{position:fixed;inset:0;z-index:99999;background:rgba(2,8,23,.72);display:none;align-items:center;justify-content:center;padding:18px}
      .cgn-shell-login-card{width:min(430px,96vw);background:#fff;color:#07172f;border:1px solid #d6dce7;box-shadow:0 20px 60px rgba(0,0,0,.28);padding:20px}
      .cgn-shell-login-card h3{margin:0 0 10px}.cgn-shell-login-label{display:block;margin:10px 0 5px;font-size:12px;font-weight:900;text-transform:uppercase}.cgn-shell-login-input{width:100%;padding:11px;border:1px solid #b8c0cc;font-size:15px}.cgn-shell-login-message{min-height:18px;color:#a41212;font-size:13px;margin:10px 0}.cgn-shell-login-actions{display:flex;gap:8px;flex-wrap:wrap}.cgn-shell-login-actions button,.cgn-shell-login-close{border:1px solid #07172f;background:#07172f;color:#fff;padding:10px 12px;font-weight:900;cursor:pointer}.cgn-shell-login-close{margin-top:10px;background:#fff;color:#07172f}

      .cgn-help-link {
        width:24px;
        height:24px;
        display:inline-flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:0;
        color:#111;
        text-decoration:none;
        line-height:1;
        flex:0 0 auto;
        transition:opacity .2s ease;
      }
      .cgn-help-link:hover,.cgn-help-link:focus{opacity:.72;text-decoration:none;color:#111;background:transparent}
      .cgn-help-mark{width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;border:2px solid #111;border-radius:999px;background:#fff;color:#111;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:10px;font-weight:900;line-height:1}
      .cgn-help-text{display:block;margin-top:1px;color:#111;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:6px;font-weight:900;line-height:1;letter-spacing:.01em;white-space:nowrap}
      .cgn-ios-app-desktop-link{width:26px;height:36px;display:inline-flex;align-items:center;justify-content:center;color:#111;text-decoration:none;flex:0 0 auto;transition:opacity .2s ease}
      .cgn-ios-app-desktop-link:hover,.cgn-ios-app-desktop-link:focus{opacity:.72;text-decoration:none;color:#111;background:transparent}
      .cgn-ios-app-phone{position:relative;display:inline-flex;align-items:center;justify-content:center;width:23px;height:32px;flex:0 0 23px;border:2px solid #111;border-radius:7px;background:radial-gradient(circle at 50% 42%,rgba(83,213,255,.18),transparent 46%),linear-gradient(180deg,rgba(7,17,31,.06),rgba(7,17,31,.02));box-shadow:inset 0 0 0 1px rgba(7,17,31,.10)}
      .cgn-ios-app-notch{position:absolute;top:3px;left:50%;width:9px;height:2px;border-radius:999px;background:#111;transform:translateX(-50%)}
      .cgn-ios-app-word{display:block;margin-top:1px;color:#111;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:7px;font-weight:900;line-height:1;letter-spacing:-.02em}
      .cgn-ios-app-home{position:absolute;bottom:3px;left:50%;width:4px;height:4px;border-radius:999px;background:#c40000;transform:translateX(-50%);box-shadow:0 0 0 1px rgba(7,17,31,.42)}
      .editor-portal-link{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;position:relative;color:#111;text-decoration:none;transition:opacity .2s ease;flex:0 0 auto}
      .editor-portal-link:hover,.editor-portal-link:focus{opacity:.65;text-decoration:none;color:#111;background:transparent}
      .editor-portal-text{display:none}
      .editor-portal-pen{width:17px;height:4px;background:#111;border-radius:999px;transform:rotate(-38deg);position:relative;display:block}
      .editor-portal-pen::before{content:"";position:absolute;left:-5px;top:0;width:0;height:0;border-top:2px solid transparent;border-bottom:2px solid transparent;border-right:6px solid #111}
      .editor-portal-pen::after{content:"";position:absolute;right:-4px;top:0;width:4px;height:4px;background:#111;border-radius:1px}
      .footer-cgn-mark{object-fit:contain}
      .article-card{display:block;color:#07172f;text-decoration:none;border:1px solid #dfe4eb;background:#fff}.article-card img{width:100%;height:160px;object-fit:cover;display:block;background:#e5e7eb}.article-body{padding:14px}.article-body h3{margin:5px 0 7px;font-size:19px;line-height:1.2}.article-meta{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#667085;font-weight:900}.article-body p{margin:0;color:#475467;line-height:1.45}.empty{border:1px solid #dfe4eb;background:#f7f9fc;color:#475467;padding:16px;line-height:1.45}
      @media(max-width:1120px){.top-bar{display:grid;grid-template-columns:1fr;justify-items:center}.brand-link{justify-content:center;text-align:center;flex-direction:column}.brand-text{align-items:center}.nav{justify-content:center}.right-tools{justify-content:center}.brand-link .logo{height:auto;max-width:min(92vw,290px)}}
      @media(max-width:700px){.top-bar{padding:10px;gap:10px}.nav{gap:10px;white-space:normal}.nav-dropdown{right:auto;left:50%;transform:translateX(-50%);max-width:calc(100vw - 24px)}.right-tools{width:100%;justify-content:center}.cgn-bureau-weather-time{min-width:120px}.social-link,.support-link{width:36px;height:36px}.ticker{padding:9px 10px}.market-ticker-live{padding:0 10px}.footer-container{grid-template-columns:1fr 1fr}.footer-container>div:first-child{grid-column:1 / -1}}
      @media(max-width:430px){.right-tools{gap:7px}.cgn-bureau-weather-time{order:10;flex-basis:100%;max-width:none;text-align:center}.cgn-bureau-time,.cgn-bureau-weather,.cgn-bureau-location{text-align:center}.footer-container{grid-template-columns:1fr}.network-name{font-size:10px}.brand-tagline{font-size:10.5px}}
    `;
    document.head.appendChild(style);
  }

  function updateAccountUI(){
    const b = document.getElementById("account-btn");
    if(b) b.textContent = getUser() ? "Account" : "Login";
  }

  function openShellLogin(){
    let m = document.getElementById("login-modal");
    if(!m){
      m = document.createElement("div");
      m.id = "login-modal";
      m.className = "cgn-shell-login-modal";
      m.innerHTML = '<div class="cgn-shell-login-card"><h3>Account Access</h3><p class="widget-note" style="color:#475467">Create a free account to unlock free articles. Subscribers get unlimited access.</p><label class="cgn-shell-login-label" for="login-email">Email</label><input id="login-email" class="cgn-shell-login-input" type="email"><label class="cgn-shell-login-label" for="login-password">Password</label><input id="login-password" class="cgn-shell-login-input" type="password"><div id="cgn-shell-login-message" class="cgn-shell-login-message"></div><div class="cgn-shell-login-actions"><button type="button" onclick="loginUser()">Login</button><button type="button" onclick="signupUser()">Create Account</button></div><button type="button" class="cgn-shell-login-close" onclick="closeLogin()">Close</button></div>';
      document.body.appendChild(m);
      m.addEventListener("click", e => { if(e.target === m) closeShellLogin(); });
    }
    m.style.display = "flex";
  }

  function closeShellLogin(){
    const m = document.getElementById("login-modal");
    if(m) m.style.display = "none";
  }

  function setShellLoginMessage(message){
    const msg = document.getElementById("cgn-shell-login-message");
    if(msg) msg.textContent = message || "";
  }

  async function authAction(action){
    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");
    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";
    if(!email || !password){
      setShellLoginMessage("Enter email and password.");
      return;
    }

    setShellLoginMessage(action === "signup" ? "Creating account..." : "Logging in...");

    try{
      const qs = new URLSearchParams({action, email, password});
      const res = await fetch(`${API_BASE}?${qs.toString()}`, {cache:"no-store"});
      const data = await res.json();

      if(data && data.success){
        const userId = data.user_id || data.userId || data.user?.user_id || data.user?.id || "";
        const userEmail = data.email || data.user?.email || email;
        if(userId){
          localStorage.setItem("user_id", userId);
          localStorage.setItem("cgn_user_id", userId);
        }
        if(userEmail) localStorage.setItem("user_email", userEmail);
        applySubscriberState(Object.assign({}, data, data.user || {}));
        if(userId) await syncSubscriberState(userId);
        try{ localStorage.setItem("cgn_user", JSON.stringify(data.user || data)); }catch(e){}

        setShellLoginMessage(action === "signup" ? "Account created." : "Logged in.");
        closeShellLogin();
        updateAccountUI();
        document.dispatchEvent(new CustomEvent(action === "signup" ? "cgn:signup" : "cgn:login", { detail:data }));

        if(typeof window.loadArticle === "function") window.loadArticle();
        else if(typeof window.loadOzarkArticle === "function") window.loadOzarkArticle();
        else location.reload();
        return;
      }

      setShellLoginMessage((data && (data.error || data.message)) || (action === "signup" ? "Signup failed." : "Login failed."));
    }catch(e){
      console.error("CGN ACCOUNT ERROR:", e);
      setShellLoginMessage(action === "signup" ? "Unable to create account right now." : "Unable to log in right now.");
    }
  }

  window.openLogin = openShellLogin;
  window.closeLogin = closeShellLogin;
  window.loginUser = () => authAction("login");
  window.signupUser = () => authAction("signup");

  function accountClick(e){
    e.preventDefault();
    if(!getUser()){
      openShellLogin();
      return;
    }
    const menu = document.getElementById("account-menu");
    if(menu) menu.classList.toggle("open");
  }

  function logout(){
    localStorage.removeItem("user_id");
    localStorage.removeItem("cgn_user_id");
    localStorage.removeItem("user_email");
    localStorage.removeItem("cgn_user");
    localStorage.removeItem("subscriber");
    updateAccountUI();
    document.dispatchEvent(new CustomEvent("cgn:logout"));
    location.reload();
  }

  function toggleCategoryMenu(event){
    event.preventDefault();
    event.stopPropagation();
    const menuWrap = event.currentTarget.closest(".nav-more");
    if(menuWrap) menuWrap.classList.toggle("open");
  }

  const instagramIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.75 2h8.5A5.76 5.76 0 0 1 22 7.75v8.5A5.76 5.76 0 0 1 16.25 22h-8.5A5.76 5.76 0 0 1 2 16.25v-8.5A5.76 5.76 0 0 1 7.75 2Zm0 2A3.75 3.75 0 0 0 4 7.75v8.5A3.75 3.75 0 0 0 7.75 20h8.5A3.75 3.75 0 0 0 20 16.25v-8.5A3.75 3.75 0 0 0 16.25 4h-8.5Zm8.75 1.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7.25A4.75 4.75 0 1 1 12 16.75 4.75 4.75 0 0 1 12 7.25Zm0 2A2.75 2.75 0 1 0 12 14.75 2.75 2.75 0 0 0 12 9.25Z"></path></svg>';
  const xIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2H21.5l-7.11 8.13L22.75 22h-6.55l-5.13-6.71L5.2 22H1.94l7.6-8.69L1.5 2h6.72l4.64 6.13L18.244 2Zm-1.15 17.91h1.8L7.24 3.98H5.31l11.784 15.93Z"></path></svg>';
  const youtubeIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.5 6.2a3.02 3.02 0 0 0-2.13-2.14C19.48 3.56 12 3.56 12 3.56s-7.48 0-9.37.5A3.02 3.02 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.13 2.14c1.89.5 9.37.5 9.37.5s7.48 0 9.37-.5a3.02 3.02 0 0 0 2.13-2.14A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8ZM9.6 15.56V8.44L15.85 12 9.6 15.56Z"></path></svg>';

  const helpButtonHtml = `
          <a href="/support/" class="cgn-help-link" aria-label="Open Ozark Gazette Technical Support">
            <span class="cgn-help-mark" aria-hidden="true">?</span>
            <span class="cgn-help-text">Help?</span>
          </a>`;

  const iosAppIconHtml = `
          <a id="cgn-ios-app-desktop-link" class="cgn-ios-app-desktop-link" href="https://www.cgnnews.net/ios" aria-label="Get the CGN NOW iOS app">
            <span class="cgn-ios-app-phone" aria-hidden="true">
              <span class="cgn-ios-app-notch"></span>
              <span class="cgn-ios-app-word">iOS</span>
              <span class="cgn-ios-app-home"></span>
            </span>
          </a>`;

  const editorPortalIconHtml = `
          <a href="https://ozarks.cgnnews.net/editor/" class="editor-portal-link" aria-label="Open Ozark Gazette Editor Portal">
            <span class="editor-portal-pen" aria-hidden="true"></span>
            <span class="editor-portal-text">EDITOR LOGIN</span>
          </a>`;

  const newsDirectoryIconHtml = `
          <a id="news-directory-link" class="news-directory-link" href="/news/" aria-label="The Ozark Gazette news directory">
            <span class="news-directory-icon" aria-hidden="true">
              <span class="news-directory-word">NEWS</span>
              <span class="news-directory-paper">
                <span class="news-directory-line news-directory-line-wide"></span>
                <span class="news-directory-line"></span>
                <span class="news-directory-line"></span>
                <span class="news-directory-box"></span>
              </span>
            </span>
          </a>`;

  const sportsCenterIconHtml = `
          <a id="sports-center-link" class="sports-center-link" href="/sports/" aria-label="Ozark Gazette Sports Center">
            <img src="/CGNSportsCenterIcon01.png" class="sports-center-icon" alt="" aria-hidden="true">
          </a>`;

  const trafficCenterIconHtml = `
          <a id="traffic-center-link" class="traffic-center-link" href="/traffic/" aria-label="Ozark Gazette Traffic Center">
            <img src="/CGNTrafficCenterIcon01.png" class="traffic-center-icon" alt="" aria-hidden="true">
          </a>`;

  function renderHeader(){
    const mount = document.getElementById("cgn-site-header");
    if(!mount) return;
    injectShellStyles();
    mount.innerHTML = `
      <a class="skip-link" href="#main-content">Skip to content</a>
      <header class="top-bar">
        <a href="/" class="brand-link" aria-label="The Ozark Gazette homepage">
          <img src="/OzarkGazetteLogo.png" class="logo" alt="The Ozark Gazette">
          <span class="brand-text">
            <span class="network-name">The Ozark Gazette</span>
            <span class="brand-tagline">Your Source for Ozark News, Weather, Sports and Traffic</span>
          </span>
        </a>
        <nav class="nav" aria-label="Main Navigation">
          <a href="/local/">Local</a>
          <a href="/us/">US</a>
          <a href="/world/">World</a>
          <a href="/politics/">Politics</a>
          <a href="/markets/">Markets</a>
          <span class="nav-more">
            <button class="nav-more-button" type="button" aria-label="More Ozark Gazette categories" aria-haspopup="true" aria-expanded="false">▾</button>
            <span id="category-dropdown" class="nav-dropdown" role="menu">
              <a href="/technology/" role="menuitem">Technology</a>
              <a href="/entertainment/" role="menuitem">Entertainment</a>
              <a href="/environment/" role="menuitem">Environment</a>
              <a href="/investigations/" role="menuitem">Investigations</a>
              <a href="/opinion/" role="menuitem">Opinion</a>
              <a href="/obituaries/" role="menuitem">Obituaries</a>
              <a href="/classifieds/" role="menuitem">Classifieds</a>
              <a href="/weather/" role="menuitem">Weather</a>
              <a href="/weather/radar/" role="menuitem">Radar</a>
              <a href="/traffic/" role="menuitem">Traffic</a>
              <a href="/sports/" role="menuitem">Sports</a>
              <a href="/news/" role="menuitem">View All News</a>
            </span>
          </span>
        </nav>
        <div class="right-tools" aria-label="Account, local conditions, social links and support">
          <span class="account-wrap">
            <a href="#" id="account-btn">Login</a>
            <span id="account-menu" class="account-menu" aria-label="Account menu">
              <a href="/account/">Account</a>
              <button type="button" id="account-logout-btn">Logout</button>
            </span>
          </span>
          <a id="cgn-bureau-weather-time" class="cgn-bureau-weather-time" href="/weather/" aria-label="Open Ozark weather">
            <span id="cgn-bureau-mobile-line" class="cgn-bureau-mobile-line"><span class="cgn-bureau-mobile-date">Loading date...</span><span class="cgn-bureau-mobile-clock">Loading time...</span><span class="cgn-bureau-mobile-city">Tecumseh</span></span>
            <span id="cgn-bureau-time" class="cgn-bureau-time">Loading local time...</span>
            <span id="cgn-bureau-weather" class="cgn-bureau-weather">Loading weather...</span>
            <span id="cgn-bureau-location" class="cgn-bureau-location">Tecumseh</span>
          </a>
          <span id="datetime" class="cgn-shell-compat-hidden" aria-hidden="true"></span>
          <span id="weather" class="cgn-shell-compat-hidden" aria-hidden="true"></span>
          <a id="cgn-mobile-weather-mini" class="cgn-mobile-weather-mini" href="/weather/" aria-label="Open Ozark weather"><span id="cgn-mobile-weather-compact" class="cgn-mobile-weather-compact">🌤 --°F</span></a>
          ${newsDirectoryIconHtml}
          ${sportsCenterIconHtml}
          ${trafficCenterIconHtml}
          ${helpButtonHtml}
          <a class="social-link social-instagram" href="https://www.instagram.com/cookglobalnews/" target="_blank" rel="noopener noreferrer" aria-label="CGN News on Instagram">${instagramIcon}</a>
          <a class="social-link social-x" href="https://x.com/CookGlobalNews" target="_blank" rel="noopener noreferrer" aria-label="CGN News on X">${xIcon}</a>
          <a class="social-link social-youtube" href="https://www.youtube.com/@CookGlobalNews" target="_blank" rel="noopener noreferrer" aria-label="CGN News on YouTube">${youtubeIcon}</a>
          ${iosAppIconHtml}
          ${editorPortalIconHtml}
        </div>
      </header>
      <div class="ticker" id="cgn-shell-ticker" aria-label="The Ozark Gazette live headline feed"><span class="ticker-label">Latest</span><div class="ticker-viewport"><div class="ticker-track"><span class="ticker-group"><span class="ticker-item"><a href="/news/">Loading Ozark headlines...</a></span></span></div></div></div>
      <section class="market-ticker-wrap" aria-label="Markets Brief live stock ticker">
        <a class="market-ticker-click" href="/markets/center/">Open Markets Brief</a>
        <div class="market-ticker-live">
          <span class="market-ticker-label">Markets Brief</span>
          <div class="market-tv-ticker cgn-shell-market-tv" aria-hidden="true"><div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div></div></div>
        </div>
      </section>`;

    document.getElementById("account-btn")?.addEventListener("click", accountClick);
    document.getElementById("account-logout-btn")?.addEventListener("click", logout);
    const moreBtn = mount.querySelector(".nav-more-button");
    if(moreBtn){
      moreBtn.addEventListener("click", function(event){
        toggleCategoryMenu(event);
        const wrap = event.currentTarget.closest(".nav-more");
        event.currentTarget.setAttribute("aria-expanded", wrap && wrap.classList.contains("open") ? "true" : "false");
      });
    }
    document.addEventListener("click", function(e){
      const accountWrap = document.querySelector(".account-wrap");
      if(accountWrap && !accountWrap.contains(e.target)) document.getElementById("account-menu")?.classList.remove("open");
      const navMore = document.querySelector(".nav-more");
      if(navMore && !navMore.contains(e.target)){
        navMore.classList.remove("open");
        navMore.querySelector(".nav-more-button")?.setAttribute("aria-expanded", "false");
      }
    });
    updateAccountUI();
    if(getUser()) syncSubscriberState(getUser());
    initWeatherTime();
    loadTicker();
    renderTradingViewTicker();
  }

  function footerSocialHtml(){
    return `
      <div class="footer-social">
        <a href="https://instagram.com/cookglobalnews" target="_blank" rel="noopener noreferrer" aria-label="CGN News on Instagram">
          <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 2C4.243 2 2 4.243 2 7v10c0 2.757 2.243 5 5 5h10c2.757 0 5-2.243 5-5V7c0-2.757-2.243-5-5-5H7zm0 2h10c1.654 0 3 1.346 3 3v10c0 1.654-1.346 3-3 3H7c-1.654 0-3-1.346-3-3V7c0-1.654 1.346-3 3-3zm5 2.8A5.2 5.2 0 006.8 12 5.2 5.2 0 0012 17.2 5.2 5.2 0 0017.2 12 5.2 5.2 0 0012 6.8zm0 2A3.2 3.2 0 0115.2 12 3.2 3.2 0 0112 15.2 3.2 3.2 0 018.8 12 3.2 3.2 0 0112 8.8zm4.5-2.3a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z"/>
          </svg>
        </a>
        <a href="https://x.com/CookGlobalNews" target="_blank" rel="noopener noreferrer" aria-label="CGN News on X">
          <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18.244 2H21l-6.56 7.5L22 22h-6.828l-5.35-7.01L3.5 22H1l7.03-8.03L2 2h6.914l4.83 6.37L18.244 2zM17.15 20h1.52L7.03 4H5.4l11.75 16z"/>
          </svg>
        </a>
        <a href="https://youtube.com/@CookGlobalNews" target="_blank" rel="noopener noreferrer" aria-label="CGN News on YouTube">
          <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.376.505A3.016 3.016 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.376-.505a3.016 3.016 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.75 15.568V8.432L15.818 12 9.75 15.568z"/>
          </svg>
        </a>
      </div>
    `;
  }

  function renderFooter(){
    const mount = document.getElementById("cgn-site-footer");
    if(!mount) return;
    injectShellStyles();
    mount.innerHTML = `
      <footer class="footer">
        <div class="footer-container">
          <div>
            <a class="footer-cgn-logo-link" href="https://www.cgnnews.net/" aria-label="Open CGN News">
              <img src="/CGNLogo.webp" class="footer-cgn-mark" alt="CGN News">
            </a>
            <p class="cgn-tag">Real-Time News.<br>Global Perspective.</p>
            <p><strong>The Ozark Gazette</strong><br>P.O. Box 794<br>33256 U.S. Highway 160<br>Tecumseh, Missouri 65760<br>📱 (317) 442-1437<br><a href="mailto:tips@cgnnews.net">📧 tips@cgnnews.net</a></p>
          </div>
          <div>
            <h4><a href="/news/">News</a></h4>
            <a href="/local/">Local</a><br>
            <a href="/us/">US</a><br>
            <a href="/world/">World</a><br>
            <a href="/politics/">Politics</a><br>
            <a href="/markets/">Markets</a><br>
            <a href="/investigations/">Investigations</a><br>
            <a href="/opinion/">Opinion</a>
          </div>
          <div>
            <h4>Briefs</h4>
            <a href="/weather/">Weather Center</a><br>
            <a href="/weather/radar/">Weather Radar</a><br>
            <a href="/traffic/">Traffic Center</a><br>
            <a href="/sports/">Sports Center</a><br>
            <a href="/markets/center/">Market Watch</a><br>
            <a href="/obituaries/">Obituaries</a><br>
            <a href="/archives/">Archives</a>
          </div>
          <div>
            <h4>Community</h4>
            <a href="/horoscopes/">Horoscopes</a><br>
            <a href="/sudoku/">Sudoku</a><br>
            <a href="/puzzles/">Puzzles</a><br>
            <a href="/crosswords/">Crosswords</a><br>
            <a href="/reporters/">Reporters</a><br>
            <a href="/classifieds/">Classifieds</a><br>
            <a class="footer-support-advertise" href="https://www.cgnnews.net/advertise/">Advertise With Us</a>
          </div>
          <div>
            <h4><a href="/support/">Support</a></h4>
            <a href="/about/">About</a><br>
            <a href="/contact/">Contact</a><br>
            <a href="/support/">Support</a><br>
            <a href="https://www.cgnnews.net/privacy-policy">Privacy</a><br>
            <a href="https://www.cgnnews.net/terms-of-service">Terms</a><br>
            <a href="https://www.cgnnews.net/editorial-standards/">Editorial Standards</a><br>
            <a href="https://www.cgnnews.net/copyright/">Copyright Notice</a><br>
            ${footerSocialHtml()}
          </div>
        </div>
        <div class="footer-veteran-owned-block">
          <a class="footer-veteran-owned-link" href="https://www.cgnnews.net/equal-opportunity/">🇺🇸 VETERAN OWNED BUSINESS</a>
        </div>
        <div class="footer-bottom">
          <a href="https://www.cgnnews.net/copyright/">Copyright © 2026 | CGN News — All Rights Reserved</a>
          <div class="footer-developed">Developed by <a href="https://cts.cook-international.com" target="_blank" rel="noopener noreferrer">Cook Technology Services</a></div>
        </div>
      </footer>`;
  }

  function parseShortOffsetMinutes(label){
    const raw = String(label || "").trim();
    if(raw === "GMT" || raw === "UTC") return 0;

    const m = raw.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/i);
    if(!m) return null;

    const sign = m[1] === "-" ? -1 : 1;
    const hours = Number(m[2] || 0);
    const minutes = Number(m[3] || 0);
    return sign * ((hours * 60) + minutes);
  }

  function normalizeTimeZoneLabel(city, label){
    const raw = String(label || "").trim();
    if(raw && !/^(GMT|UTC)(?:[+-]|$)/i.test(raw)) return raw;

    const offset = parseShortOffsetMinutes(raw);

    if(city.timeZone === "America/Indiana/Indianapolis" || city.timeZone === "America/New_York"){
      if(offset === -240) return "EDT";
      if(offset === -300) return "EST";
      return raw || "ET";
    }

    if(city.timeZone === "America/Chicago"){
      if(offset === -300) return "CDT";
      if(offset === -360) return "CST";
      return raw || "CT";
    }

    if(city.timeZone === "America/Los_Angeles"){
      if(offset === -420) return "PDT";
      if(offset === -480) return "PST";
      return raw || "PT";
    }

    return raw;
  }

  function getActiveBureauCity(){
    return OZARK_BUREAU_CITIES[ozarkBureauIndex] || OZARK_BUREAU_CITIES[0];
  }

  function getBureauWeather(city){
    return ozarkBureauWeatherCache[city.name] || null;
  }

  function formatLocalParts(city){
    city = city || getActiveBureauCity();
    const parts = new Intl.DateTimeFormat("en-US", {
      day:"2-digit",
      month:"long",
      year:"numeric",
      hour:"numeric",
      minute:"2-digit",
      second:"2-digit",
      hour12:true,
      timeZone:city.timeZone,
      timeZoneName:"short"
    }).formatToParts(new Date());

    const map = {};
    parts.forEach(p => { map[p.type] = p.value; });
    const zone = normalizeTimeZoneLabel(city, map.timeZoneName);
    const dateText = `${map.day} ${map.month} ${map.year}`.replace(/\s+/g, " ").trim();
    const clockText = `${map.hour}:${map.minute}:${map.second} ${map.dayPeriod || ""}${zone ? " " + zone : ""}`.replace(/\s+/g, " ").trim();
    return {dateText, clockText, fullText:`${dateText} | ${clockText}`};
  }

  function updateClock(){
    const city = getActiveBureauCity();
    const timeEl = document.getElementById("cgn-bureau-time");
    const weatherEl = document.getElementById("cgn-bureau-weather");
    const locationEl = document.getElementById("cgn-bureau-location");
    const mobileLineEl = document.getElementById("cgn-bureau-mobile-line");
    const compactEl = document.getElementById("cgn-mobile-weather-compact");
    const datetimeCompat = document.getElementById("datetime");
    const weatherCompat = document.getElementById("weather");
    const parts = formatLocalParts(city);
    const weather = getBureauWeather(city);
    const weatherText = weather && !weather.error
      ? `${weather.icon} ${weather.tempF}°F · ${weather.text}`
      : "🌤 --°F · Weather updating";
    const compactWeatherText = weather && !weather.error
      ? `${weather.icon} ${weather.tempF}°`
      : "🌤 --°";

    if(timeEl) timeEl.innerHTML = `${esc(parts.dateText)}<br>${esc(parts.clockText)}`;
    if(weatherEl) weatherEl.textContent = weatherText;
    if(locationEl) locationEl.textContent = city.name;
    if(mobileLineEl){
      mobileLineEl.innerHTML = `<span class="cgn-bureau-mobile-date">${esc(parts.dateText)}</span><span class="cgn-bureau-mobile-clock">${esc(parts.clockText)}</span><span class="cgn-bureau-mobile-city">${esc(city.name)}</span>`;
    }
    if(compactEl) compactEl.textContent = compactWeatherText;
    if(datetimeCompat) datetimeCompat.textContent = parts.fullText;
    if(weatherCompat) weatherCompat.textContent = weatherText;
    updateWeatherAria();
  }

  function weatherCodeInfo(code){
    const n = Number(code);
    if(n === 0) return {icon:"☀️", text:"Clear"};
    if([1,2,3].includes(n)) return {icon:"🌤", text:"Partly Cloudy"};
    if([45,48].includes(n)) return {icon:"🌫", text:"Fog"};
    if([51,53,55,56,57].includes(n)) return {icon:"🌦", text:"Drizzle"};
    if([61,63,65,66,67,80,81,82].includes(n)) return {icon:"🌧", text:"Rain"};
    if([71,73,75,77,85,86].includes(n)) return {icon:"❄️", text:"Snow"};
    if([95,96,99].includes(n)) return {icon:"⛈", text:"Storm"};
    return {icon:"🌤", text:"Weather"};
  }

  function updateWeatherAria(){
    const city = getActiveBureauCity();
    const linkEl = document.getElementById("cgn-bureau-weather-time");
    const mobileWeatherLinkEl = document.getElementById("cgn-mobile-weather-mini");
    const datetimeCompat = document.getElementById("datetime");
    const weatherCompat = document.getElementById("weather");
    const weatherText = weatherCompat?.textContent || "weather updating";
    const timeText = datetimeCompat?.textContent || "local time";
    if(linkEl){
      linkEl.setAttribute("aria-label", `Open Ozark weather — ${city.name}, ${timeText}, ${weatherText}`);
    }
    if(mobileWeatherLinkEl){
      mobileWeatherLinkEl.setAttribute("aria-label", `Open Ozark weather — ${city.name}, ${weatherText}`);
    }
  }

  async function loadWeatherMini(city){
    city = city || getActiveBureauCity();
    try{
      const url = "https://api.open-meteo.com/v1/forecast"
        + `?latitude=${encodeURIComponent(city.latitude)}`
        + `&longitude=${encodeURIComponent(city.longitude)}`
        + "&current=temperature_2m,weather_code"
        + "&temperature_unit=fahrenheit"
        + "&timezone=auto";

      const res = await fetch(url, {cache:"no-store"});
      if(!res.ok) throw new Error("Open-Meteo " + res.status);
      const data = await res.json();
      const current = data && data.current ? data.current : {};
      const temp = Math.round(Number(current.temperature_2m));
      if(!Number.isFinite(temp)) throw new Error("Missing temperature");
      const info = weatherCodeInfo(current.weather_code);
      ozarkBureauWeatherCache[city.name] = {
        tempF:temp,
        icon:info.icon,
        text:info.text,
        error:false,
        fetchedAt:Date.now()
      };
    }catch(e){
      ozarkBureauWeatherCache[city.name] = {
        tempF:"--",
        icon:"🌤",
        text:"Weather updating",
        error:true,
        fetchedAt:Date.now()
      };
    }

    if(city.name === getActiveBureauCity().name){
      updateClock();
    }
  }

  function loadAllBureauWeather(){
    OZARK_BUREAU_CITIES.forEach(city => loadWeatherMini(city));
  }

  function rotateBureauCity(){
    ozarkBureauIndex = (ozarkBureauIndex + 1) % OZARK_BUREAU_CITIES.length;
    updateClock();

    const city = getActiveBureauCity();
    const weather = getBureauWeather(city);
    if(!weather || (Date.now() - Number(weather.fetchedAt || 0)) > OZARK_BUREAU_WEATHER_REFRESH_MS){
      loadWeatherMini(city);
    }
  }

  function initWeatherTime(){
    if(shellClockTimer) clearInterval(shellClockTimer);
    if(shellWeatherTimer) clearInterval(shellWeatherTimer);
    if(shellRotationTimer) clearInterval(shellRotationTimer);

    ozarkBureauIndex = 0;
    updateClock();
    loadAllBureauWeather();

    shellClockTimer = setInterval(updateClock, 1000);
    shellRotationTimer = setInterval(rotateBureauCity, OZARK_BUREAU_ROTATION_MS);
    shellWeatherTimer = setInterval(loadAllBureauWeather, OZARK_BUREAU_WEATHER_REFRESH_MS);
  }

  function renderTradingViewTicker(){
    const container = document.querySelector(".cgn-shell-market-tv .tradingview-widget-container");
    if(!container || container.querySelector("script")) return;
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.async = true;
    script.text = JSON.stringify({
      symbols:[
        {description:"S&P 500", proName:"FOREXCOM:SPXUSD"},
        {description:"Nasdaq", proName:"NASDAQ:IXIC"},
        {description:"Dow", proName:"DJ:DJI"},
        {description:"Russell 2000", proName:"TVC:RUT"},
        {description:"Apple", proName:"NASDAQ:AAPL"},
        {description:"Microsoft", proName:"NASDAQ:MSFT"},
        {description:"Nvidia", proName:"NASDAQ:NVDA"},
        {description:"Walmart", proName:"NYSE:WMT"}
      ],
      showSymbolLogo:true,
      isTransparent:true,
      displayMode:"regular",
      colorTheme:"dark",
      locale:"en"
    }, null, 2);
    container.appendChild(script);
  }


  function gvizCellValue(cell){
    if(!cell) return "";
    let value = cell.v;
    if(typeof value === "string"){
      const m = value.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/);
      if(m){
        const d = new Date(Date.UTC(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0)));
        return d.toISOString();
      }
    }
    if(value === null || value === undefined || value === "") return cell.f || "";
    return value;
  }

  function normalizeArticleItem(item, sourceSheet){
    item = item || {};
    const title = String(item.title || item.seo_title || "").trim();
    const slug = item.slug || slugify(title);
    const published = item.published_at || item.publishedAt || item.updated_at || item.updatedAt || item.created_at || item.date || "";
    const category = item.category || "Local";
    const url = item.url || `/article.html?slug=${encodeURIComponent(slug)}`;
    return Object.assign({}, item, {
      article_id:item.article_id || item.id || "",
      title,
      slug,
      category,
      published_at:published,
      updated_at:item.updated_at || item.updatedAt || published,
      summary:item.summary || item.subtitle || item.seo_description || "",
      hero_image_url:item.hero_image_url || item.image_url || item.image || DEFAULT_IMG,
      image_credit:item.image_credit || item.credit || "",
      status:item.status || (sourceSheet === OZARK_SHEETS.archives ? "archived" : "published"),
      url,
      source:item.source || sourceSheet || "Articles"
    });
  }

  function normalizeArticlesPayload(payload, sourceSheet){
    let list = [];
    if(Array.isArray(payload)) list = payload;
    else if(payload && Array.isArray(payload.articles)) list = payload.articles;
    else if(payload && Array.isArray(payload.items)) list = payload.items;
    else if(payload && Array.isArray(payload.rows)) list = payload.rows;
    else if(payload && Array.isArray(payload.data)) list = payload.data;
    return list.map(item => normalizeArticleItem(item, sourceSheet)).filter(item => item.title);
  }

  async function fetchApiJson(action, params={}){
    const qs = new URLSearchParams(Object.assign({site:SITE, action}, params));
    const res = await fetch(`${API_BASE}?${qs.toString()}`, {cache:"no-store"});
    if(!res.ok) throw new Error(`Ozark API ${res.status}`);
    const json = await res.json();
    if(json && json.success === false) throw new Error(json.error || `Ozark action failed: ${action}`);
    return json;
  }

  async function fetchSheetRows(sheetName){
    const q = new URLSearchParams({sheet:sheetName, tqx:"out:json", headers:"1"});
    const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(OZARK_SHEET_ID)}/gviz/tq?${q.toString()}`;
    const res = await fetch(url, {cache:"no-store"});
    if(!res.ok) throw new Error(`Google Sheet ${sheetName} ${res.status}`);
    const text = await res.text();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if(start < 0 || end < start) throw new Error(`Invalid Google Sheet response for ${sheetName}`);
    const json = JSON.parse(text.slice(start, end + 1));
    const table = json.table || {};
    const headers = (table.cols || []).map((col, index) => String(col.label || col.id || `col${index}`).trim());
    return (table.rows || []).map(row => {
      const obj = {};
      (row.c || []).forEach((cell, index) => {
        const key = headers[index];
        if(key) obj[key] = gvizCellValue(cell);
      });
      return obj;
    });
  }

  function filterArticles(list, params={}){
    const category = String(params.category || "").trim().toLowerCase();
    return (Array.isArray(list) ? list : []).filter(a => {
      const status = String(a.status || "published").toLowerCase();
      const statusOk = !status || status === "published" || status === "archive" || status === "archived";
      const categoryOk = !category || String(a.category || "").trim().toLowerCase() === category;
      return a.title && statusOk && categoryOk;
    });
  }

  function sortArticles(list){
    return (Array.isArray(list) ? list : []).sort((a,b) => {
      const da = Number(a.display_order || 999999), db = Number(b.display_order || 999999);
      if(Number.isFinite(da) && Number.isFinite(db) && da !== db) return da - db;
      return articleTime(b) - articleTime(a);
    });
  }

  async function fetchArticles(params={}){
    const limit = Number(params.limit || 50);
    const offset = Number(params.offset || 0);
    try{
      const json = await fetchApiJson("ozark_articles", params);
      const apiList = normalizeArticlesPayload(json, OZARK_SHEETS.articles);
      if(apiList.length) return sortArticles(filterArticles(apiList, params)).slice(offset, limit ? offset + limit : undefined);
    }catch(e){
      console.warn("Ozark API Articles fallback to Google Sheet:", e);
    }
    const activeRows = normalizeArticlesPayload(await fetchSheetRows(OZARK_SHEETS.articles), OZARK_SHEETS.articles);
    return sortArticles(filterArticles(activeRows, params)).slice(offset, limit ? offset + limit : undefined);
  }

  async function fetchArchives(params={}){
    const limit = Number(params.limit || 50);
    const offset = Number(params.offset || 0);
    try{
      const json = await fetchApiJson("ozark_archives", params);
      const apiList = normalizeArticlesPayload(json, OZARK_SHEETS.archives);
      if(apiList.length) return sortArticles(filterArticles(apiList, params)).slice(offset, limit ? offset + limit : undefined);
    }catch(e){
      console.warn("Ozark API Archives fallback to Google Sheet:", e);
    }
    const rows = normalizeArticlesPayload(await fetchSheetRows(OZARK_SHEETS.archives), OZARK_SHEETS.archives);
    return sortArticles(filterArticles(rows, params)).slice(offset, limit ? offset + limit : undefined);
  }

  async function fetchArticle(params={}){
    const requested = String(params.slug || params.id || params.article_id || "").trim();
    if(!requested) return null;
    const protectedParams = Object.assign({}, params, {
      user_id:getUser(),
      anon_id:getAnonId()
    });
    try{
      const json = await fetchApiJson("ozark_article", protectedParams);
      const article = json.article || (json.title ? json : null);
      if(article && article.title) return normalizeArticleItem(article, article.source || json.source || OZARK_SHEETS.articles);
      return null;
    }catch(e){
      console.warn("Ozark API Article unavailable:", e);
      return null;
    }
  }

  async function fetchObituaries(params={}){
    try{
      const json = await fetchApiJson("ozark_obituaries", params);
      if(Array.isArray(json.obituaries)) return json.obituaries;
      if(Array.isArray(json.items)) return json.items;
    }catch(e){
      console.warn("Ozark API Obituaries fallback to Google Sheet:", e);
    }
    const rows = await fetchSheetRows(OZARK_SHEETS.obituaries);
    return rows.filter(row => row.name && String(row.status || "published").toLowerCase() === "published");
  }

  async function api(action, params={}){
    if(action === "ozark_articles"){
      const articles = await fetchArticles(params);
      return {success:true, site:SITE, sheet:OZARK_SHEETS.articles, total:articles.length, articles};
    }
    if(action === "ozark_archives"){
      const articles = await fetchArchives(params);
      return {success:true, site:SITE, sheet:OZARK_SHEETS.archives, total:articles.length, articles};
    }
    if(action === "ozark_article"){
      const article = await fetchArticle(params);
      return article ? {success:true, site:SITE, article} : {success:false, site:SITE, error:"Article not found"};
    }
    if(action === "ozark_obituaries"){
      const obituaries = await fetchObituaries(params);
      return {success:true, site:SITE, total:obituaries.length, obituaries, items:obituaries};
    }
    return await fetchApiJson(action, params);
  }

  function articleTime(a){
    const t = Date.parse(a.published_at || a.updated_at || a.date || "");
    return isNaN(t) ? 0 : t;
  }

  function articleUrl(a){
    if(a.url) return a.url;
    const slug = a.slug || slugify(a.title || "ozark-update");
    return `/article.html?slug=${encodeURIComponent(slug)}`;
  }

  function articleCard(a){
    const img = esc(a.hero_image_url || a.image || DEFAULT_IMG);
    return `<a class="article-card" href="${esc(articleUrl(a))}"><img src="${img}" alt=""><div class="article-body"><div class="article-meta">${esc(a.category || "Local")} · ${esc(formatDate(a.published_at || a.updated_at))}</div><h3>${esc(a.title || "Ozark update")}</h3><p>${esc(a.summary || a.subtitle || "")}</p></div></a>`;
  }

  function formatDate(v){
    const d = new Date(v);
    if(isNaN(d)) return "Latest";
    return new Intl.DateTimeFormat("en-US", {day:"2-digit", month:"long", year:"numeric", timeZone:"America/Chicago"}).format(d);
  }

  function renderHeadlineTicker(items){
    const safeItems = (Array.isArray(items) ? items : []).filter(Boolean);
    const fallback = [{title:"The Ozark Gazette: Your Source for Ozark News, Weather, Sports and Traffic", url:"/news/"}];
    const feed = safeItems.length ? safeItems : fallback;
    const links = feed.map(a => {
      const href = a.url || articleUrl(a) || "/news/";
      const title = a.title || a.summary || "Ozark Gazette update";
      return `<span class="ticker-item"><a href="${esc(href)}">${esc(title)}</a></span>`;
    }).join("");
    return `<span class="ticker-label">Latest</span><div class="ticker-viewport" role="presentation"><div class="ticker-track"><span class="ticker-group">${links}</span><span class="ticker-group" aria-hidden="true">${links}</span></div></div>`;
  }

  async function loadTicker(){
    const el = document.getElementById("cgn-shell-ticker");
    if(!el) return;
    try{
      const list = (await fetchArticles({limit:12})).sort((a,b) => articleTime(b) - articleTime(a));
      if(!list.length) throw new Error("no articles");
      el.innerHTML = renderHeadlineTicker(list);
    }catch(e){
      el.innerHTML = renderHeadlineTicker([{title:"The Ozark Gazette: Your Source for Ozark News, Weather, Sports and Traffic", url:"/news/"}]);
    }
  }

  async function loadArticleGrid(mountId, category, limit=9){
    const mount = document.getElementById(mountId);
    if(!mount) return;
    try{
      const params = {limit};
      if(category) params.category = category;
      const list = (await fetchArticles(params)).sort((a,b) => Number(a.display_order || 999) - Number(b.display_order || 999) || articleTime(b) - articleTime(a));
      mount.innerHTML = list.length ? list.map(articleCard).join("") : '<div class="empty">No published articles are available yet.</div>';
    }catch(e){
      mount.innerHTML = '<div class="empty">Articles are loading. Check back shortly.</div>';
    }
  }

  async function loadHome(){
    await loadArticleGrid("homeArticles", "", 12);
    await loadArticleGrid("obitStrip", "Obituaries", 3);
    await loadArticleGrid("courtStrip", "Local", 3);
    try{
      const list = await fetchArticles({limit:5});
      if(list[0]){
        document.getElementById("featureTitle").textContent = list[0].title || "The Ozark Gazette";
        document.getElementById("featureMeta").textContent = (list[0].category || "Local") + " · " + formatDate(list[0].published_at || list[0].updated_at);
        document.getElementById("featureCopy").textContent = list[0].summary || list[0].subtitle || "Local coverage from Tecumseh, Ozark County and the Missouri Ozarks.";
        document.getElementById("featureImage").src = list[0].hero_image_url || DEFAULT_IMG;
        document.getElementById("featureLink").href = articleUrl(list[0]);
      }
    }catch(e){}
  }

  async function loadCategoryPage(){
    const mount = document.querySelector("[data-article-grid]");
    if(!mount) return;
    await loadArticleGrid(mount.id, mount.getAttribute("data-category"), Number(mount.getAttribute("data-limit") || 12));
  }

  async function loadArticlePage(){
    const mount = document.getElementById("articleMount");
    if(!mount) return;
    const p = new URLSearchParams(location.search);
    const slug = p.get("slug") || p.get("id") || "";
    if(!slug){
      mount.innerHTML = '<div class="empty">Article not found.</div>';
      return;
    }
    try{
      const a = await fetchArticle({slug});
      if(!a || !a.title) throw new Error("missing");
      const locked = a.locked === true || String(a.locked || "").toLowerCase() === "true" || String(a.access || "").toLowerCase() === "preview";
      document.title = (a.seo_title || a.title) + " | The Ozark Gazette";
      mount.innerHTML = `<article class="about-section"><div class="article-meta">${esc(a.category || "Local")} · ${esc(formatDate(a.published_at || a.updated_at))} · By ${esc(a.author || "The Ozark Gazette")}</div><h1 style="font-family:Georgia,serif;font-size:clamp(34px,5vw,58px);line-height:1;margin:0 0 10px;color:#07172f">${esc(a.title)}</h1><p style="font-size:18px;color:#475467;line-height:1.55">${esc(a.subtitle || a.summary || "")}</p><img src="${esc(a.hero_image_url || DEFAULT_IMG)}" alt="" style="width:100%;max-height:460px;object-fit:cover;border:1px solid #dfe4eb"><div style="line-height:1.75;font-size:18px;margin-top:22px">${a.body_html || `<p>${esc(a.summary || "")}</p>`}</div>${locked ? `<aside class="info-card" style="padding:18px;margin-top:20px"><h2>Unlimited access</h2><p>This preview is available to free readers. Log in with an active subscription for full Ozark Gazette and CGN News access.</p><a class="section-btn" href="/account/">Account Access</a></aside>` : ""}${!locked && a.what_this_means ? `<aside class="info-card" style="padding:18px;margin-top:20px"><h2>What this means</h2><p>${esc(a.what_this_means)}</p></aside>` : ""}</article>`;
    }catch(e){
      mount.innerHTML = '<div class="empty">Article not found or not yet published.</div>';
    }
  }

  window.OzarkGazette = {api, fetchArticles, fetchArchives, fetchArticle, fetchObituaries, loadArticleGrid, loadHome, loadCategoryPage, loadArticlePage, articleCard, articleUrl, esc};
  document.addEventListener("DOMContentLoaded", () => {
    injectShellStyles();
    renderHeader();
    renderFooter();
    loadCategoryPage();
    loadArticlePage();
    if(document.body.dataset.page === "home") loadHome();
  });
})();
