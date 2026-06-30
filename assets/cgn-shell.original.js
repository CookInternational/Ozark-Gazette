(function(){

  // CGN Shell v8.3.6-Alpha
  // 27 June 2026 • header Sports text removed + Traffic Center icon link
  // Developed by Cook Technology Services
  // Site-wide backend configuration.
  // Store the deployed Apps Script Web App URL in Admin Column K as:
  // google_apps_script_web_app_url
  const CGN_DEFAULT_API_BASE = "https://script.google.com/macros/s/AKfycbw2U1Qezn44zJNnonZMZG06LpB7lh6n7cgiJY8hY34RnriYd2Eq66swuxQ7S_VyHobb/exec";

  function normalizeApiBase_(value){
    return String(value || "").trim().replace(/\?+$/, "");
  }

  function getConfiguredApiBase_(){
    const meta = document.querySelector('meta[name="cgn-api-base"]');
    const metaValue = meta ? meta.getAttribute("content") : "";
    const storedValue = localStorage.getItem("cgn_api_base") || "";
    const windowValue = window.CGN_API_BASE || "";

    return normalizeApiBase_(windowValue || metaValue || storedValue || CGN_DEFAULT_API_BASE);
  }

  const CGN_API_BASE = getConfiguredApiBase_();
  const CGN_ARTICLES_URL = CGN_API_BASE + "?action=articles";

  window.CGN_API_BASE = CGN_API_BASE;
  window.CGN_API_URL = CGN_API_BASE;
  window.CGN_CONFIG = window.CGN_CONFIG || {};
  window.CGN_CONFIG.apiBase = CGN_API_BASE;
  window.CGN_CONFIG.apiUrl = CGN_API_BASE;
  window.CGN_CONFIG.googleAppsScriptWebAppUrl = CGN_API_BASE;
  window.CGN_SET_API_BASE = function(url){
    const clean = normalizeApiBase_(url);
    if(clean){
      localStorage.setItem("cgn_api_base", clean);
      window.CGN_API_BASE = clean;
      window.CGN_API_URL = clean;
      window.CGN_CONFIG = window.CGN_CONFIG || {};
      window.CGN_CONFIG.apiBase = clean;
      window.CGN_CONFIG.apiUrl = clean;
      window.CGN_CONFIG.googleAppsScriptWebAppUrl = clean;
    }
    return window.CGN_API_BASE;
  };
  let cgnShellTickerTimer = null;

  const CGN_BUREAU_ROTATION_MS = 7000;
  const CGN_BUREAU_WEATHER_REFRESH_MS = 10 * 60 * 1000;

  const CGN_BUREAU_CITIES = [
    {
      name: "Indianapolis",
      location: "Indianapolis, IN",
      latitude: 39.7684,
      longitude: -86.1581,
      timeZone: "America/Indiana/Indianapolis"
    },
    {
      name: "Chicago",
      location: "Chicago, IL",
      latitude: 41.8781,
      longitude: -87.6298,
      timeZone: "America/Chicago"
    },
    {
      name: "London",
      location: "London, England",
      latitude: 51.5072,
      longitude: -0.1276,
      timeZone: "Europe/London"
    },
    {
      name: "Sydney",
      location: "Sydney, Australia",
      latitude: -33.8688,
      longitude: 151.2093,
      timeZone: "Australia/Sydney"
    },
    {
      name: "Hong Kong",
      location: "Hong Kong",
      latitude: 22.3193,
      longitude: 114.1694,
      timeZone: "Asia/Hong_Kong"
    },
    {
      name: "Rio de Janeiro",
      location: "Rio de Janeiro",
      latitude: -22.9068,
      longitude: -43.1729,
      timeZone: "America/Sao_Paulo"
    },
    {
      name: "Manila",
      location: "Manila, Philippines",
      latitude: 14.5995,
      longitude: 120.9842,
      timeZone: "Asia/Manila"
    },
    {
      name: "Mumbai",
      location: "Mumbai, India",
      latitude: 19.0760,
      longitude: 72.8777,
      timeZone: "Asia/Kolkata"
    }
  ];

  let cgnBureauIndex = 0;
  let cgnBureauClockTimer = null;
  let cgnBureauRotationTimer = null;
  let cgnBureauWeatherTimer = null;
  const cgnBureauWeatherCache = {};

  function getUser(){
    return localStorage.getItem("user_id") || "";
  }

  function logoutUser(){
    localStorage.removeItem("user_id");
    localStorage.removeItem("subscriber");

    const menu = document.getElementById("account-menu");
    if(menu) menu.classList.remove("open");

    updateAccountUI();
  }

  function updateAccountUI(){
    const btn = document.getElementById("account-btn");
    if(!btn) return;

    if(getUser()){
      btn.innerText = "Account";
      btn.setAttribute("aria-label", "CGN News account");
    } else {
      btn.innerText = "Login";
      btn.setAttribute("aria-label", "Login or create CGN News account");
    }
  }

function getShellLoginInput_(id){
    return document.getElementById(id);
  }

  function setShellLoginMessage_(message){
    const el = document.getElementById("cgn-shell-login-message");
    if(el) el.textContent = message || "";
  }

  function normalizeShellLoginModal_(modal){
    if(!modal) return null;

    modal.id = "login-modal";
    modal.classList.add("cgn-shell-login-modal");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "cgn-shell-login-title");

    if(!modal.dataset.cgnShellLoginOutsideClose){
      modal.addEventListener("click", function(event){
        if(event.target === modal) closeShellLogin();
      });
      modal.dataset.cgnShellLoginOutsideClose = "true";
    }

    if(!modal.classList.contains("cgn-shell-login-open")){
      modal.classList.add("cgn-shell-login-closed");
      modal.setAttribute("aria-hidden", "true");
      modal.hidden = true;
      modal.style.display = "none";
      modal.style.pointerEvents = "none";
    }

    return modal;
  }

  function renderShellLoginModal(){
    const existing = document.getElementById("login-modal");

    if(existing){
      return normalizeShellLoginModal_(existing);
    }

    const modal = document.createElement("div");
    modal.id = "login-modal";
    modal.className = "cgn-shell-login-modal cgn-shell-login-closed";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "cgn-shell-login-title");
    modal.setAttribute("aria-hidden", "true");
    modal.hidden = true;
    modal.style.display = "none";
    modal.style.pointerEvents = "none";

    modal.innerHTML = `
      <div class="cgn-shell-login-card">
        <h3 id="cgn-shell-login-title">Account Access</h3>

        <p class="cgn-shell-login-note">
          Create a free account to unlock 6 free articles. Subscribers get unlimited access.
        </p>

        <label class="cgn-shell-login-label" for="login-email">Email</label>
        <input id="login-email" class="cgn-shell-login-input" type="email" placeholder="Email" autocomplete="email">

        <label class="cgn-shell-login-label" for="login-password">Password</label>
        <input id="login-password" class="cgn-shell-login-input" type="password" placeholder="Password" autocomplete="current-password">

        <div id="cgn-shell-login-message" class="cgn-shell-login-message" aria-live="polite"></div>

        <div class="cgn-shell-login-actions">
          <button type="button" onclick="loginUser()">Login</button>
          <button type="button" onclick="signupUser()">Create Account</button>
        </div>

        <p class="cgn-shell-login-reset">
          <a href="/reset-password/">Forgot Password?</a>
        </p>

        <button type="button" class="cgn-shell-login-close" onclick="closeLogin()">Close</button>
      </div>
    `;

    normalizeShellLoginModal_(modal);
    document.body.appendChild(modal);
    return modal;
  }

  function openShellLogin(){
    const modal = renderShellLoginModal();
    if(!modal) return;

    modal.hidden = false;
    modal.classList.remove("cgn-shell-login-closed");
    modal.classList.add("cgn-shell-login-open");
    modal.setAttribute("aria-hidden", "false");
    modal.style.display = "flex";
    modal.style.pointerEvents = "auto";
    document.body.classList.add("cgn-shell-login-is-open");

    const menu = document.getElementById("account-menu");
    if(menu) menu.classList.remove("open");

    setShellLoginMessage_("");

    const email = getShellLoginInput_("login-email");
    if(email){
      setTimeout(function(){ email.focus(); }, 50);
    }
  }

  function closeShellLogin(){
    const modal = document.getElementById("login-modal");
    if(!modal){
      document.body.classList.remove("cgn-shell-login-is-open");
      return;
    }

    modal.classList.remove("cgn-shell-login-open");
    modal.classList.add("cgn-shell-login-closed");
    modal.setAttribute("aria-hidden", "true");
    modal.style.pointerEvents = "none";
    modal.style.display = "none";
    modal.hidden = true;
    document.body.classList.remove("cgn-shell-login-is-open");
  }

  async function shellLoginUser(){
    const emailInput = getShellLoginInput_("login-email");
    const passwordInput = getShellLoginInput_("login-password");
    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";

    if(!email || !password){
      setShellLoginMessage_("Enter email and password.");
      return;
    }

    setShellLoginMessage_("Logging in...");

    try{
      const res = await fetch(`${CGN_API_BASE}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
      const data = await res.json();

      if(data && data.success){
        const userId = data.user_id || data.userId || data.user?.user_id || data.user?.id || "";
        if(userId) localStorage.setItem("user_id", userId);
        if(data.subscriber || data.user?.subscriber) localStorage.setItem("subscriber", "true");
        if(data.subscriber === false || data.user?.subscriber === false) localStorage.removeItem("subscriber");

        setShellLoginMessage_("Logged in.");
        closeShellLogin();
        updateAccountUI();

        document.dispatchEvent(new CustomEvent("cgn:login", { detail:data }));

        if(typeof window.loadArticle === "function"){
          window.loadArticle();
        } else if(new URLSearchParams(window.location.search).get("subscribe") === "1" && typeof window.requireLoginForSubscribe === "function"){
          window.requireLoginForSubscribe();
        }

        return;
      }

      setShellLoginMessage_((data && (data.error || data.message)) || "Login failed.");
    } catch(e){
      console.error("CGN LOGIN ERROR:", e);
      setShellLoginMessage_("Unable to log in right now.");
    }
  }

  async function shellSignupUser(){
    const emailInput = getShellLoginInput_("login-email");
    const passwordInput = getShellLoginInput_("login-password");
    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";

    if(!email || !password){
      setShellLoginMessage_("Enter email and password.");
      return;
    }

    setShellLoginMessage_("Creating account...");

    try{
      const res = await fetch(`${CGN_API_BASE}?action=signup&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
      const data = await res.json();

      if(data && data.success){
        const userId = data.user_id || data.userId || data.user?.user_id || data.user?.id || "";
        if(userId) localStorage.setItem("user_id", userId);
        if(data.subscriber || data.user?.subscriber) localStorage.setItem("subscriber", "true");
        if(data.subscriber === false || data.user?.subscriber === false) localStorage.removeItem("subscriber");

        setShellLoginMessage_("Account created.");
        closeShellLogin();
        updateAccountUI();

        document.dispatchEvent(new CustomEvent("cgn:signup", { detail:data }));

        if(typeof window.loadArticle === "function"){
          window.loadArticle();
        } else if(new URLSearchParams(window.location.search).get("subscribe") === "1" && typeof window.requireLoginForSubscribe === "function"){
          window.requireLoginForSubscribe();
        }

        return;
      }

      setShellLoginMessage_((data && (data.error || data.message)) || "Signup failed.");
    } catch(e){
      console.error("CGN SIGNUP ERROR:", e);
      setShellLoginMessage_("Unable to create account right now.");
    }
  }

  function publishAccountLoginGlobals(){
    window.openLogin = openShellLogin;
    window.closeLogin = closeShellLogin;
    window.loginUser = shellLoginUser;
    window.signupUser = shellSignupUser;
    window.CGN_OPEN_LOGIN = openShellLogin;
  }

  function handleAccountClick(event){
    event.preventDefault();

    if(!getUser()){
      openShellLogin();
      return;
    }

    closeShellLogin();

    const menu = document.getElementById("account-menu");
    if(menu) menu.classList.toggle("open");
  }

  function toggleCategoryMenu(event){
    event.preventDefault();
    event.stopPropagation();
    const menuWrap = event.currentTarget.closest(".nav-more");
    if(menuWrap) menuWrap.classList.toggle("open");
  }

  function weatherCodeInfo(code){
    const n = Number(code);

    if(n === 0) return { icon:"☀️", text:"Clear" };
    if([1,2,3].includes(n)) return { icon:"🌤", text:"Partly Cloudy" };
    if([45,48].includes(n)) return { icon:"🌫", text:"Fog" };
    if([51,53,55,56,57].includes(n)) return { icon:"🌦", text:"Drizzle" };
    if([61,63,65,66,67,80,81,82].includes(n)) return { icon:"🌧", text:"Rain" };
    if([71,73,75,77,85,86].includes(n)) return { icon:"❄️", text:"Snow" };
    if([95,96,99].includes(n)) return { icon:"⛈", text:"Storm" };

    return { icon:"🌤", text:"Weather" };
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

    if(city.timeZone === "America/Indiana/Indianapolis"){
      if(offset === -240) return "EDT";
      if(offset === -300) return "EST";
      return raw || "ET";
    }

    if(city.timeZone === "America/Chicago"){
      if(offset === -300) return "CDT";
      if(offset === -360) return "CST";
      return raw || "CT";
    }

    if(city.timeZone === "Europe/London"){
      if(offset === 60) return "BST";
      if(offset === 0) return "GMT";
      return raw || "GMT";
    }

    if(city.timeZone === "Australia/Sydney"){
      if(offset === 660) return "AEDT";
      if(offset === 600) return "AEST";
      return raw || "AEST";
    }

    if(city.timeZone === "Asia/Hong_Kong") return "HKT";
    if(city.timeZone === "America/Sao_Paulo") return "BRT";
    if(city.timeZone === "Asia/Manila") return "PHT";
    if(city.timeZone === "Asia/Kolkata") return "IST";

    return raw;
  }

  function formatBureauLocalParts(city){
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
    parts.forEach(function(p){ map[p.type] = p.value; });

    const zone = normalizeTimeZoneLabel(city, map.timeZoneName);
    const dateText = `${map.day} ${map.month} ${map.year}`.replace(/\s+/g, " ").trim();
    const clockText = `${map.hour}:${map.minute}:${map.second} ${map.dayPeriod || ""}${zone ? " " + zone : ""}`.replace(/\s+/g, " ").trim();

    return {
      dateText: dateText,
      clockText: clockText,
      fullText: `${dateText} | ${clockText}`
    };
  }

  function formatBureauLocalTime(city){
    return formatBureauLocalParts(city).fullText;
  }

  function getActiveBureauCity(){
    return CGN_BUREAU_CITIES[cgnBureauIndex] || CGN_BUREAU_CITIES[0];
  }

  function getBureauWeather(city){
    return cgnBureauWeatherCache[city.name] || null;
  }

  function setBureauCompatText(city, timeText, weatherText){
    const datetimeCompat = document.getElementById("datetime");
    if(datetimeCompat){
      datetimeCompat.textContent = timeText;
    }

    const weatherCompat = document.getElementById("weather");
    if(weatherCompat){
      weatherCompat.textContent = weatherText;
    }
  }

  function updateDateTime(){
    const city = getActiveBureauCity();
    const timeParts = formatBureauLocalParts(city);
    const timeText = timeParts.fullText;
    const weather = getBureauWeather(city);

    const timeEl = document.getElementById("cgn-bureau-time");
    const weatherEl = document.getElementById("cgn-bureau-weather");
    const locationEl = document.getElementById("cgn-bureau-location");
    const mobileLineEl = document.getElementById("cgn-bureau-mobile-line");
    const mobileWeatherEl = document.getElementById("cgn-mobile-weather-compact");
    const mobileWeatherLinkEl = document.getElementById("cgn-mobile-weather-mini");
    const linkEl = document.getElementById("cgn-bureau-weather-time");

    const weatherText = weather && !weather.error
      ? `${weather.icon} ${weather.tempF}°F · ${weather.text}`
      : "🌤 --°F · Weather updating";

    const compactWeatherText = weather && !weather.error
      ? `${weather.icon} ${weather.tempF}°`
      : "🌤 --°";

    if(timeEl){
      timeEl.innerHTML = `${safeText(timeParts.dateText)}<br>${safeText(timeParts.clockText)}`;
    }
    if(weatherEl) weatherEl.textContent = weatherText;
    if(locationEl) locationEl.textContent = city.name;
    if(mobileLineEl){
      mobileLineEl.innerHTML = `
        <span class="cgn-bureau-mobile-date">${safeText(timeParts.dateText)}</span>
        <span class="cgn-bureau-mobile-clock">${safeText(timeParts.clockText)}</span>
        <span class="cgn-bureau-mobile-city">${safeText(city.name)}</span>
      `;
    }
    if(mobileWeatherEl) mobileWeatherEl.textContent = compactWeatherText;
    if(linkEl) linkEl.setAttribute("aria-label", `Open CGN Weather — ${city.name}, ${timeText}, ${weatherText}`);
    if(mobileWeatherLinkEl) mobileWeatherLinkEl.setAttribute("aria-label", `Open CGN Weather — ${city.name}, ${compactWeatherText}`);

    setBureauCompatText(city, timeText, weatherText);
  }

  function setWeather(tempF){
    const city = getActiveBureauCity();
    cgnBureauWeatherCache[city.name] = {
      tempF: tempF === "--" ? "--" : Math.round(Number(tempF)),
      icon: "🌤",
      text: tempF === "--" ? "Weather updating" : "Weather",
      error: tempF === "--"
    };
    updateDateTime();
  }

  async function loadBureauWeather(city){
    if(!city) return;

    try{
      const url = "https://api.open-meteo.com/v1/forecast"
        + `?latitude=${encodeURIComponent(city.latitude)}`
        + `&longitude=${encodeURIComponent(city.longitude)}`
        + "&current=temperature_2m,weather_code"
        + "&temperature_unit=fahrenheit"
        + "&timezone=auto";

      const res = await fetch(url, { cache:"no-store" });
      if(!res.ok) throw new Error("Open-Meteo " + res.status);

      const data = await res.json();
      const current = data && data.current ? data.current : null;

      if(!current || current.temperature_2m === undefined || current.temperature_2m === null){
        throw new Error("Missing current weather");
      }

      const info = weatherCodeInfo(current.weather_code);
      cgnBureauWeatherCache[city.name] = {
        tempF: Math.round(Number(current.temperature_2m)),
        icon: info.icon,
        text: info.text,
        error: false,
        fetchedAt: Date.now()
      };

    } catch(e){
      cgnBureauWeatherCache[city.name] = {
        tempF: "--",
        icon: "🌤",
        text: "Weather updating",
        error: true,
        fetchedAt: Date.now()
      };
    }

    if(city.name === getActiveBureauCity().name){
      updateDateTime();
    }
  }

  function loadAllBureauWeather(){
    CGN_BUREAU_CITIES.forEach(function(city){
      loadBureauWeather(city);
    });
  }

  function rotateBureauCity(){
    cgnBureauIndex = (cgnBureauIndex + 1) % CGN_BUREAU_CITIES.length;
    updateDateTime();

    const city = getActiveBureauCity();
    const weather = getBureauWeather(city);
    if(!weather || (Date.now() - Number(weather.fetchedAt || 0)) > CGN_BUREAU_WEATHER_REFRESH_MS){
      loadBureauWeather(city);
    }
  }

  function initBureauWeatherTime(){
    if(cgnBureauClockTimer) clearInterval(cgnBureauClockTimer);
    if(cgnBureauRotationTimer) clearInterval(cgnBureauRotationTimer);
    if(cgnBureauWeatherTimer) clearInterval(cgnBureauWeatherTimer);

    cgnBureauIndex = 0;
    updateDateTime();
    loadAllBureauWeather();

    cgnBureauClockTimer = setInterval(updateDateTime, 1000);
    cgnBureauRotationTimer = setInterval(rotateBureauCity, CGN_BUREAU_ROTATION_MS);
    cgnBureauWeatherTimer = setInterval(loadAllBureauWeather, CGN_BUREAU_WEATHER_REFRESH_MS);
  }

  async function loadWeather(lat, lon){
    const city = {
      name: "Indianapolis",
      location: "Indianapolis, IN",
      latitude: lat,
      longitude: lon,
      timeZone: "America/Indiana/Indianapolis"
    };
    await loadBureauWeather(city);
  }

  function safeText(v){
    return String(v || "").replace(/[&<>"']/g, function(c){
      return {
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        '"':"&quot;",
        "'":"&#039;"
      }[c];
    });
  }

  function slugify(value){
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getArticleTime(article){
    if(!article) return 0;

    const directDate = article.published_at || article.updated_at || article.date || article.created_at || "";

    if(directDate){
      const parsed = new Date(directDate).getTime();
      if(!isNaN(parsed)) return parsed;
    }

    const year = String(article.year || "").trim();
    const month = String(article.month || "").trim().padStart(2, "0");
    const day = String(article.day || "").trim().padStart(2, "0");

    if(year && month && day){
      const parsedParts = new Date(`${year}-${month}-${day}T00:00:00Z`).getTime();
      if(!isNaN(parsedParts)) return parsedParts;
    }

    return 0;
  }

  function sortNewestFirst(list){
    return [...list].sort(function(a, b){
      return getArticleTime(b) - getArticleTime(a);
    });
  }

  function buildArticleUrl(article){
    const existingUrl = String(article && article.url || "").trim();

    if(existingUrl){
      if(existingUrl.startsWith("http")) return existingUrl;
      return existingUrl.endsWith("/") ? existingUrl : existingUrl + "/";
    }

    const slug = String(article && article.slug || "").trim() || slugify(article && article.title || "cgn-news-update");
    const time = getArticleTime(article);
    const date = time ? new Date(time) : new Date();

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");

    return `/news/${year}/${month}/${day}/${slug}/`;
  }

  function startShellHeadlineTicker(articles){
    const ticker = document.getElementById("cgn-shell-ticker");
    if(!ticker) return;

    const tickerArticles = Array.isArray(articles) ? sortNewestFirst(articles) : [];

    if(!tickerArticles.length){
      ticker.innerHTML = `<a href="/news">BREAKING: CGN News</a>`;
      return;
    }

    let i = 0;

    function updateTicker(){
      if(!tickerArticles[i]) return;
      const article = tickerArticles[i];
      const title = safeText(article.title || "CGN News");
      const url = buildArticleUrl(article);
      ticker.innerHTML = `<a href="${url}">BREAKING: ${title}</a>`;
      i = (i + 1) % tickerArticles.length;
    }

    if(cgnShellTickerTimer) clearInterval(cgnShellTickerTimer);
    updateTicker();
    cgnShellTickerTimer = setInterval(updateTicker, 3000);
  }

  async function loadShellHeadlineTicker(){
    const ticker = document.getElementById("cgn-shell-ticker");
    if(!ticker) return;

    try{
      const res = await fetch(CGN_ARTICLES_URL);
      const data = await res.json();
      startShellHeadlineTicker(Array.isArray(data) ? data : []);
    } catch(e){
      ticker.innerHTML = `<a href="/news">BREAKING: CGN News</a>`;
    }
  }

  function shouldShowEditorPen(){
    const path = String(window.location.pathname || "/").replace(/\/+$/, "") || "/";
    return path !== "/editor";
  }

  function editorPenHtml(){
    if(!shouldShowEditorPen()) return "";
    return `
      <a href="/editor" class="editor-portal-link" aria-label="Open CGN Editor Portal">
        <span class="editor-portal-pen" aria-hidden="true"></span>
        <span class="editor-portal-text">EDITOR LOGIN</span>
      </a>
    `;
  }

  function supportHelpHtml(){
    return `
      <a href="/support/" class="cgn-help-link" aria-label="Open CGN Technical Support">
        <span class="cgn-help-mark" aria-hidden="true">?</span>
        <span class="cgn-help-text">Help?</span>
      </a>
    `;
  }

  function renderHeader(){
    const mount = document.getElementById("cgn-site-header");
    if(!mount) return;

    mount.innerHTML = `
      <header class="top-bar">

        <a href="/" class="brand-link" aria-label="CGN News homepage">
          <img src="/CGNNewsLogo01.png" class="logo" alt="CGN News">
          <span class="network-name">Cook Global News Network</span>
        </a>

        <nav class="nav" aria-label="Main Navigation">
          <a href="/category/world">World</a>
          <a href="/category/politics">Politics</a>
          <a href="/category/business">Business</a>
          <a href="/category/markets">Markets</a>
          <a href="/category/technology">Technology</a>
          <span class="nav-more">
            <button class="nav-more-button" type="button" aria-label="More CGN News categories" aria-haspopup="true">▾</button>
            <span id="category-dropdown" class="nav-dropdown" role="menu">
              <a href="/category/entertainment">Entertainment</a>
              <a href="/category/environment">Environment</a>
              <a href="/category/energy">Energy</a>
              <a href="/category/opinion">Opinion</a>
              <a href="/category/local">Local</a>
              <a href="/category/investigations">Investigations</a>
              <a href="/category/special-reports">Special Reports</a>
              <a href="/category/religion-and-spirituality/">Religion &amp; Spirituality</a>
              <a href="/news/">View All News</a>
            </span>
          </span>
        </nav>

        <div class="right-tools">

          <span class="account-wrap">
            <a href="#" id="account-btn">Login</a>
            <span id="account-menu" class="account-menu" aria-label="Account menu">
              <a href="/account">Account</a>
              <button type="button" id="account-logout-btn">Logout</button>
            </span>
          </span>

          <a id="cgn-bureau-weather-time" class="cgn-bureau-weather-time" href="/weather/" aria-label="Open CGN Weather">
            <span id="cgn-bureau-mobile-line" class="cgn-bureau-mobile-line"><span class="cgn-bureau-mobile-date">Loading date...</span><span class="cgn-bureau-mobile-clock">Loading time...</span><span class="cgn-bureau-mobile-city">Indianapolis</span></span>
            <span id="cgn-bureau-time" class="cgn-bureau-time">Loading local time...</span>
            <span id="cgn-bureau-weather" class="cgn-bureau-weather">🌤 Loading weather...</span>
            <span id="cgn-bureau-location" class="cgn-bureau-location">Indianapolis</span>
          </a>
          <span id="datetime" class="cgn-shell-compat-hidden" aria-hidden="true"></span>
          <span id="weather" class="cgn-shell-compat-hidden" aria-hidden="true"></span>

          <a id="cgn-mobile-weather-mini" class="cgn-mobile-weather-mini" href="/weather/" aria-label="Open CGN Weather">
            <span id="cgn-mobile-weather-compact" class="cgn-mobile-weather-compact">🌤 --°F</span>
          </a>

          <a id="news-directory-link" class="news-directory-link" href="/news" aria-label="CGN News directory">
            <span class="news-directory-icon" aria-hidden="true">
              <span class="news-directory-word">NEWS</span>
              <span class="news-directory-paper">
                <span class="news-directory-line news-directory-line-wide"></span>
                <span class="news-directory-line"></span>
                <span class="news-directory-line"></span>
                <span class="news-directory-box"></span>
              </span>
            </span>
          </a>

          <a id="sports-center-link" class="sports-center-link" href="/sports" aria-label="CGN Sports Center">
            <img src="/CGNSportsCenterIcon01.png" class="sports-center-icon" alt="">
          </a>

          <a id="traffic-center-link" class="traffic-center-link" href="/traffic" aria-label="CGN Traffic Center">
            <img src="/CGNTrafficCenterIcon01.png" class="traffic-center-icon" alt="">
          </a>

          ${supportHelpHtml()}

          <a href="https://instagram.com/cookglobalnews" target="_blank" rel="noopener" aria-label="CGN News on Instagram">
            <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 2C4.243 2 2 4.243 2 7v10c0 2.757 2.243 5 5 5h10c2.757 0 5-2.243 5-5V7c0-2.757-2.243-5-5-5H7zm0 2h10c1.654 0 3 1.346 3 3v10c0 1.654-1.346 3-3 3H7c-1.654 0-3-1.346-3-3V7c0-1.654 1.346-3 3-3zm5 2.8A5.2 5.2 0 006.8 12 5.2 5.2 0 0012 17.2 5.2 5.2 0 0017.2 12 5.2 5.2 0 0012 6.8zm0 2A3.2 3.2 0 0115.2 12 3.2 3.2 0 0112 15.2 3.2 3.2 0 018.8 12 3.2 3.2 0 0112 8.8zm4.5-2.3a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z"/>
            </svg>
          </a>

          <a href="https://x.com/CookGlobalNews" target="_blank" rel="noopener" aria-label="CGN News on X">
            <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.244 2H21l-6.56 7.5L22 22h-6.828l-5.35-7.01L3.5 22H1l7.03-8.03L2 2h6.914l4.83 6.37L18.244 2zM17.15 20h1.52L7.03 4H5.4l11.75 16z"/>
            </svg>
          </a>

          <a href="https://youtube.com/@CookGlobalNews" target="_blank" rel="noopener" aria-label="CGN News on YouTube">
            <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.376.505A3.016 3.016 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.376-.505a3.016 3.016 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.75 15.568V8.432L15.818 12 9.75 15.568z"/>
            </svg>
          </a>

          <a id="cgn-ios-app-desktop-link" class="cgn-ios-app-desktop-link" href="/ios/" aria-label="Get the CGN NOW iOS app">
            <span class="cgn-ios-app-phone" aria-hidden="true">
              <span class="cgn-ios-app-notch"></span>
              <span class="cgn-ios-app-word">iOS</span>
              <span class="cgn-ios-app-home"></span>
            </span>
          </a>

          ${editorPenHtml()}

        </div>

        <a id="cgn-ios-app-mobile-link" class="cgn-ios-app-mobile-link" href="/ios/" aria-label="Get the CGN NOW iOS app">
          <span class="cgn-ios-app-phone" aria-hidden="true">
            <span class="cgn-ios-app-notch"></span>
            <span class="cgn-ios-app-word">iOS</span>
            <span class="cgn-ios-app-home"></span>
          </span>
          <span class="cgn-ios-app-text">Get the iOS App</span>
        </a>

      </header>

      <div class="ticker" id="cgn-shell-ticker"><a href="/news">Loading headlines...</a></div>

      <section class="market-ticker-wrap" aria-label="CGN Market Watch live stock ticker">
        <a class="market-ticker-click" href="/category/markets/market-watch/" aria-label="Open CGN Market Watch">Open CGN Market Watch</a>
        <div class="market-ticker-live">
          <span class="market-ticker-label">Market Watch</span>
          <div class="market-tv-ticker cgn-shell-market-tv" aria-hidden="true">
            <div class="tradingview-widget-container">
              <div class="tradingview-widget-container__widget"></div>
            </div>
          </div>
        </div>
      </section>
    `;

    const accountBtn = document.getElementById("account-btn");
    if(accountBtn) accountBtn.addEventListener("click", handleAccountClick);

    const logoutBtn = document.getElementById("account-logout-btn");
    if(logoutBtn) logoutBtn.addEventListener("click", logoutUser);

    const moreBtn = mount.querySelector(".nav-more-button");
    if(moreBtn) moreBtn.addEventListener("click", toggleCategoryMenu);

    updateAccountUI();
    initBureauWeatherTime();
    loadShellHeadlineTicker();
    renderTradingViewTicker();
  }

  function renderTradingViewTicker(){
    const container = document.querySelector(".cgn-shell-market-tv .tradingview-widget-container");
    if(!container || container.querySelector("script")) return;

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.async = true;
    script.text = JSON.stringify({
      symbols: [
        {description:"Apple", proName:"NASDAQ:AAPL"},
        {description:"Microsoft", proName:"NASDAQ:MSFT"},
        {description:"Nvidia", proName:"NASDAQ:NVDA"},
        {description:"Amazon", proName:"NASDAQ:AMZN"},
        {description:"Alphabet", proName:"NASDAQ:GOOGL"},
        {description:"Meta", proName:"NASDAQ:META"},
        {description:"Tesla", proName:"NASDAQ:TSLA"},
        {description:"Broadcom", proName:"NASDAQ:AVGO"},
        {description:"Berkshire", proName:"NYSE:BRK.B"},
        {description:"JPMorgan", proName:"NYSE:JPM"},
        {description:"Eli Lilly", proName:"NYSE:LLY"},
        {description:"Walmart", proName:"NYSE:WMT"},
        {description:"Exxon Mobil", proName:"NYSE:XOM"},
        {description:"Costco", proName:"NASDAQ:COST"},
        {description:"UnitedHealth", proName:"NYSE:UNH"}
      ],
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: "regular",
      colorTheme: "dark",
      locale: "en"
    }, null, 2);

    container.appendChild(script);
  }

  function footerSocialHtml(){
    return `
      <div class="footer-social">
        <a href="https://instagram.com/cookglobalnews" target="_blank" rel="noopener" aria-label="CGN News on Instagram">
          <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 2C4.243 2 2 4.243 2 7v10c0 2.757 2.243 5 5 5h10c2.757 0 5-2.243 5-5V7c0-2.757-2.243-5-5-5H7zm0 2h10c1.654 0 3 1.346 3 3v10c0 1.654-1.346 3-3 3H7c-1.654 0-3-1.346-3-3V7c0-1.654 1.346-3 3-3zm5 2.8A5.2 5.2 0 006.8 12 5.2 5.2 0 0012 17.2 5.2 5.2 0 0017.2 12 5.2 5.2 0 0012 6.8zm0 2A3.2 3.2 0 0115.2 12 3.2 3.2 0 0112 15.2 3.2 3.2 0 018.8 12 3.2 3.2 0 0112 8.8zm4.5-2.3a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z"/>
          </svg>
        </a>
        <a href="https://x.com/CookGlobalNews" target="_blank" rel="noopener" aria-label="CGN News on X">
          <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18.244 2H21l-6.56 7.5L22 22h-6.828l-5.35-7.01L3.5 22H1l7.03-8.03L2 2h6.914l4.83 6.37L18.244 2zM17.15 20h1.52L7.03 4H5.4l11.75 16z"/>
          </svg>
        </a>
        <a href="https://youtube.com/@CookGlobalNews" target="_blank" rel="noopener" aria-label="CGN News on YouTube">
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

    mount.innerHTML = `
      <footer class="footer">

        <div class="footer-container">

          <div>
            <a href="/"><img src="/CGNNewsLogo01.png" class="footer-logo" alt="CGN News"></a>
            <p>Real-Time News.<br>Global Perspective.</p>
          </div>

          <div>
            <h4><a href="/news">News</a></h4>
            <a href="/category/world">World</a><br>
            <a href="/category/politics">Politics</a><br>
            <a href="/category/business">Business</a><br>
            <a href="/category/markets">Markets</a><br>
            <a href="/category/technology">Technology</a><br>
            <a href="/investigations">Investigations</a><br>
            <a href="/weather">Weather</a><br>
            <a href="/category/religion-and-spirituality">Religion & Spirituality</a>
          </div>

          <div class="footer-link-column">
            <h4><a href="/reporters">Reporters</a></h4>
            <a href="/special-reports">Special Reports</a><br>
            <a href="/category/entertainment">Entertainment</a><br>
            <a href="/category/environment">Environment</a><br>
            <a href="/category/energy">Energy</a><br>
            <a href="/category/opinion">Opinion</a><br>
            <a href="/category/local">Local</a><br>
            <a href="/sports">Sports</a><br>
            <a href="/archives" class="footer-legal-archives">Archives</a>
          </div>

          <div class="footer-legal-links">
            <h4><a href="/editorial-standards">Editorial Standards</a></h4>
            <a href="/about">About Us</a><br>
            <a href="/contact">Contact Us</a><br>
            <a href="/terms-of-service">Terms of Service</a><br>
            <a href="/privacy-policy">Privacy Policy</a><br>
            <a href="mailto:tips@cgnnews.net?subject=RE%3A%20Tip">Submit a Tip</a><br>
            <a href="/write-for-us">Write For Us</a><br>
            <a href="/advertise">Advertise With Us</a><br>
            <a href="/copyright">Copyright</a><br>
          </div>

          <div class="footer-bureau">
            <h4><a href="/bureaus">Bureaus</a></h4>
            <p class="footer-bureau-name">Cook Global News Network</p>
            <p>151 N. Delaware Street<br>Suite 122<br>Indianapolis, IN 46204</p>
            <p><a href="mailto:tips@cgnnews.net">tips@cgnnews.net</a><br>+1 (317) 442-1437</p>
            ${footerSocialHtml()}
          </div>

        </div>

        <div class="footer-eo-block" aria-label="Equal Opportunity Employer notice">
          <p class="footer-eo-title"><a href="/equal-opportunity/">EQUAL OPPORTUNITY EMPLOYER</a></p>
          <div class="footer-eo-copy">
            <p class="footer-eo-policy">CGN News is an equal opportunity employer, and does not discriminate on the basis of race, sex, religion, color, national origin, gender identity, pregnancy status, disability status, veteran status or any other protected category as defined by law, and in accordance with the Civil Rights Act of 1964, as amended, Americans with Disabilities Act of 1990, as amended, the Vietnam Era Veterans’ Readjustment Assistance Act of 1974, as amended, Uniformed Services Employment &amp; Reemployment Rights Act of 1994, as amended, and the Rehabilitation Act of 1973, as amended.</p>
            <p class="footer-eo-reporting">If you believe you have experienced discrimination in the employment process, you may contact the Equal Employment Opportunity Commission by visiting <a href="https://www.eeoc.gov" target="_blank" rel="noopener">www.eeoc.gov</a> or by mail at: 131 M Street, NE, Washington, D.C., 20507 or, for IN, KY, and MI applicants and employees: 115 W. Washington Street, South Tower, Suite 600, Indianapolis, IN 46204.</p>
          </div>
          <p class="footer-veteran-owned">VETERAN OWNED BUSINESS</p>
        </div>

        <div class="footer-utility-links">
          <p><a href="/unsubscribe">Unsubscribe From Newsletter</a></p>
        </div>

        <div class="footer-bottom">
          <a href="/copyright">Copyright © 2026 | CGN News — All Rights Reserved</a>
        </div>

      </footer>
    `;
  }

  function injectStyles(){
    if(document.getElementById("cgn-shell-styles")) return;

    const style = document.createElement("style");
    style.id = "cgn-shell-styles";
    style.textContent = `
      .cgn-shell-login-modal {
        position:fixed;
        inset:0;
        width:100%;
        height:100%;
        background:rgba(0,0,0,0.6);
        z-index:99999;
        font-family:Arial, Helvetica, sans-serif;
        color:#111;
        align-items:flex-start;
        justify-content:center;
      }

      .cgn-shell-login-modal.cgn-shell-login-closed,
      .cgn-shell-login-modal[hidden] {
        display:none !important;
        pointer-events:none !important;
      }

      .cgn-shell-login-modal.cgn-shell-login-open {
        display:flex !important;
        pointer-events:auto !important;
      }

      body.cgn-shell-login-is-open {
        overflow:hidden;
      }

      .cgn-shell-login-card {
        box-sizing:border-box;
        background:#fff;
        padding:25px;
        max-width:420px;
        margin:100px auto;
        text-align:center;
        border-radius:6px;
        box-shadow:0 20px 55px rgba(0,0,0,.28);
      }

      .cgn-shell-login-card h3 {
        margin:0 0 10px;
        font-size:22px;
        line-height:1.2;
      }

      .cgn-shell-login-note {
        font-size:13px;
        color:#666;
        line-height:1.45;
        margin:0 0 12px;
      }

      .cgn-shell-login-label {
        position:absolute !important;
        width:1px !important;
        height:1px !important;
        padding:0 !important;
        margin:-1px !important;
        overflow:hidden !important;
        clip:rect(0, 0, 0, 0) !important;
        white-space:nowrap !important;
        border:0 !important;
      }

      .cgn-shell-login-input {
        box-sizing:border-box;
        width:90%;
        margin:10px;
        padding:10px;
        border:1px solid #bbb;
        font-size:14px;
      }

      .cgn-shell-login-message {
        min-height:18px;
        margin:6px 0 8px;
        color:#555;
        font-size:12px;
        line-height:1.4;
      }

      .cgn-shell-login-actions {
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        justify-content:center;
        margin-top:6px;
      }

      .cgn-shell-login-actions button,
      .cgn-shell-login-close {
        padding:10px 13px;
        border:1px solid #111;
        background:#111;
        color:#fff;
        font-weight:800;
        cursor:pointer;
      }

      .cgn-shell-login-actions button:nth-child(2),
      .cgn-shell-login-close {
        background:#fff;
        color:#111;
      }

      .cgn-shell-login-reset {
        margin:10px 0;
        font-size:12px;
      }

      .cgn-shell-login-reset a {
        color:#111;
        font-weight:700;
      }

      @media (max-width: 560px) {
        .cgn-shell-login-card {
          width:calc(100vw - 28px);
          margin:72px auto;
          padding:20px 16px;
        }

        .cgn-shell-login-input {
          width:100%;
          margin:8px 0;
        }

        .cgn-shell-login-actions {
          flex-direction:column;
        }
      }

      .logo { height:95px; }

      .top-bar {
        display:flex;
        justify-content:space-between;
        align-items:center;
        padding:10px 20px;
        border-bottom:1px solid #ddd;
        gap:20px;
        background:#fff;
        color:#111;
        font-family:Arial, Helvetica, sans-serif;
      }

      .nav {
        display:flex;
        gap:20px;
        font-weight:600;
        align-items:center;
        white-space:nowrap;
      }

      .nav a {
        text-decoration:none;
        color:#111;
        font-size:14px;
      }

      .nav a:hover { text-decoration:underline; }

      .right-tools {
        display:flex;
        gap:15px;
        align-items:center;
        font-size:13px;
        white-space:nowrap;
      }

      #account-btn {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:7px 12px;
        border:1px solid #111;
        border-radius:999px;
        color:#111;
        text-decoration:none;
        font-weight:700;
        line-height:1;
        background:#fff;
      }

      #account-btn:hover {
        background:#111;
        color:#fff;
        text-decoration:none;
      }

      #cgn-site-header {
        position:relative;
        z-index:20;
        isolation:isolate;
        pointer-events:auto;
      }

      #cgn-site-header * {
        pointer-events:auto;
      }

      .cgn-shell-compat-hidden {
        position:absolute !important;
        width:1px !important;
        height:1px !important;
        padding:0 !important;
        margin:-1px !important;
        overflow:hidden !important;
        clip:rect(0, 0, 0, 0) !important;
        white-space:nowrap !important;
        border:0 !important;
      }

      .cgn-bureau-weather-time {
        display:inline-flex;
        flex-direction:column;
        align-items:flex-end;
        justify-content:center;
        min-width:148px;
        max-width:210px;
        color:#111;
        text-decoration:none;
        font-weight:800;
        line-height:1.12;
        white-space:nowrap;
        text-align:right;
      }

      .cgn-bureau-weather-time:hover {
        opacity:.78;
        text-decoration:none;
      }

      .cgn-bureau-mobile-line,
      .cgn-mobile-weather-mini {
        display:none;
      }

      .cgn-mobile-weather-mini:hover {
        opacity:.78;
        text-decoration:none;
      }

      .cgn-bureau-time {
        display:block;
        font-size:12px;
        font-weight:900;
        color:#111;
      }

      .cgn-bureau-weather {
        display:block;
        margin-top:2px;
        font-size:12px;
        font-weight:800;
        color:#111;
      }

      .cgn-bureau-location {
        display:block;
        margin-top:1px;
        font-size:10px;
        font-weight:500;
        color:#555;
      }

      #weather {
        text-decoration:none;
        color:#111;
        font-weight:600;
      }

      .social-icon {
        width:20px;
        height:20px;
        fill:#111;
        display:block;
        transition:opacity .2s ease;
      }

      .social-icon:hover { opacity:.65; }

      .editor-portal-link {
        width:22px;
        height:22px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        position:relative;
        color:#111;
        text-decoration:none;
        transition:opacity .2s ease;
      }

      .editor-portal-text {
        display:none;
      }

      .editor-portal-link:hover {
        opacity:.65;
        text-decoration:none;
      }

      .editor-portal-pen {
        width:17px;
        height:4px;
        background:#111;
        border-radius:999px;
        transform:rotate(-38deg);
        position:relative;
        display:block;
      }

      .editor-portal-pen::before {
        content:"";
        position:absolute;
        left:-5px;
        top:0;
        width:0;
        height:0;
        border-top:2px solid transparent;
        border-bottom:2px solid transparent;
        border-right:6px solid #111;
      }

      .editor-portal-pen::after {
        content:"";
        position:absolute;
        right:-4px;
        top:0;
        width:4px;
        height:4px;
        background:#111;
        border-radius:1px;
      }

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

      .cgn-help-link:hover {
        opacity:.72;
        text-decoration:none;
      }

      .cgn-help-mark {
        width:14px;
        height:14px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        border:2px solid #111;
        border-radius:999px;
        background:#fff;
        color:#111;
        font-family:Arial Black, Arial, Helvetica, sans-serif;
        font-size:10px;
        font-weight:900;
        line-height:1;
      }

      .cgn-help-text {
        display:block;
        margin-top:1px;
        color:#111;
        font-family:Arial Black, Arial, Helvetica, sans-serif;
        font-size:6px;
        font-weight:900;
        line-height:1;
        letter-spacing:.01em;
        white-space:nowrap;
      }

      .cgn-ios-app-desktop-link {
        width:26px;
        height:36px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        color:#111;
        text-decoration:none;
        flex:0 0 auto;
        transition:opacity .2s ease;
      }

      .cgn-ios-app-desktop-link:hover {
        opacity:.72;
        text-decoration:none;
      }

      .cgn-ios-app-desktop-link .cgn-ios-app-phone {
        width:23px;
        height:32px;
        border-color:#111;
        background:
          radial-gradient(circle at 50% 42%, rgba(83,213,255,.18), transparent 46%),
          linear-gradient(180deg, rgba(7,17,31,.06), rgba(7,17,31,.02));
        box-shadow:inset 0 0 0 1px rgba(7,17,31,.10);
      }

      .cgn-ios-app-desktop-link .cgn-ios-app-notch {
        background:#111;
      }

      .cgn-ios-app-desktop-link .cgn-ios-app-word {
        color:#111;
        font-size:7px;
      }

      .cgn-ios-app-desktop-link .cgn-ios-app-home {
        width:4px;
        height:4px;
        background:#c40000;
        box-shadow:0 0 0 1px rgba(7,17,31,.42);
      }

      .cgn-ios-app-mobile-link {
        display:none;
        align-items:center;
        justify-content:center;
        gap:10px;
        width:100%;
        max-width:430px;
        min-height:44px;
        padding:9px 12px;
        margin:0 auto;
        border:1px solid rgba(7,17,31,.18);
        border-radius:14px;
        background:linear-gradient(135deg, #07111f, #102a4d);
        color:#fff;
        text-decoration:none;
        font-family:Arial, Helvetica, sans-serif;
        box-shadow:0 10px 24px rgba(7,17,31,.14);
      }

      .cgn-ios-app-mobile-link:hover {
        opacity:.9;
        text-decoration:none;
      }

      .cgn-ios-app-phone {
        position:relative;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width:25px;
        height:36px;
        flex:0 0 25px;
        border:2px solid #fff;
        border-radius:7px;
        background:
          radial-gradient(circle at 50% 42%, rgba(83,213,255,.22), transparent 46%),
          linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.02));
        box-shadow:inset 0 0 0 1px rgba(83,213,255,.24);
      }

      .cgn-ios-app-notch {
        position:absolute;
        top:3px;
        left:50%;
        width:9px;
        height:2px;
        border-radius:999px;
        background:rgba(255,255,255,.85);
        transform:translateX(-50%);
      }

      .cgn-ios-app-word {
        display:block;
        margin-top:1px;
        color:#fff;
        font-family:Arial Black, Arial, Helvetica, sans-serif;
        font-size:8px;
        font-weight:900;
        line-height:1;
        letter-spacing:-.02em;
      }

      .cgn-ios-app-home {
        position:absolute;
        bottom:3px;
        left:50%;
        width:5px;
        height:5px;
        border-radius:999px;
        background:#c40000;
        transform:translateX(-50%);
        box-shadow:0 0 0 1px rgba(255,255,255,.74);
      }

      .cgn-ios-app-text {
        display:inline-flex;
        align-items:center;
        color:#fff;
        font-family:Arial Black, Arial, Helvetica, sans-serif;
        font-size:13px;
        font-weight:900;
        letter-spacing:.03em;
        line-height:1;
        text-transform:uppercase;
        white-space:nowrap;
      }

      .brand-link {
        display:flex;
        flex-direction:column;
        align-items:center;
        text-decoration:none;
        color:#111;
        line-height:1;
        flex-shrink:0;
      }

      .network-name {
        margin-top:3px;
        font-family:Arial Black, Arial, Helvetica, sans-serif;
        font-weight:900;
        font-size:10px;
        letter-spacing:.08em;
        text-transform:uppercase;
        color:#111;
        white-space:nowrap;
      }

      .nav-more {
        position:relative;
        display:inline-flex;
        align-items:center;
      }

      .nav-more-button {
        border:0;
        background:transparent;
        color:#111;
        cursor:pointer;
        font-weight:800;
        font-size:14px;
        padding:4px 0 4px 2px;
        line-height:1;
      }

      .nav-more-button:hover { text-decoration:underline; }

      .nav-dropdown {
        display:none;
        position:absolute;
        top:100%;
        right:0;
        min-width:170px;
        background:#fff;
        border:1px solid #ddd;
        box-shadow:0 12px 30px rgba(0,0,0,.12);
        z-index:50;
        padding:8px 0;
      }

      .nav-more:hover .nav-dropdown,
      .nav-more:focus-within .nav-dropdown,
      .nav-more.open .nav-dropdown {
        display:block;
      }

      .nav-dropdown a {
        display:block;
        padding:9px 14px;
        color:#111;
        text-decoration:none;
        font-size:13px;
        white-space:nowrap;
      }

      .nav-dropdown a:hover {
        background:#f4f4f4;
        text-decoration:none;
      }

      .account-wrap {
        position:relative;
        display:inline-flex;
      }

      .account-menu {
        display:none;
        position:absolute;
        top:calc(100% + 8px);
        right:0;
        min-width:150px;
        padding:8px 0;
        background:#fff;
        border:1px solid #ddd;
        box-shadow:0 12px 30px rgba(0,0,0,.12);
        z-index:60;
      }

      .account-menu.open { display:block; }

      .account-menu a,
      .account-menu button {
        display:block;
        width:100%;
        box-sizing:border-box;
        padding:9px 14px;
        background:#fff;
        border:0;
        color:#111;
        text-align:left;
        text-decoration:none;
        font-size:13px;
        cursor:pointer;
      }

      .account-menu a:hover,
      .account-menu button:hover { background:#f4f4f4; }

      .news-directory-link {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width:28px;
        height:28px;
        color:#111;
        text-decoration:none;
        flex:0 0 auto;
      }

      .news-directory-link:hover {
        opacity:.72;
        text-decoration:none;
      }

      .news-directory-icon {
        width:28px;
        height:28px;
        display:inline-flex;
        flex-direction:column;
        align-items:center;
        justify-content:flex-start;
        position:relative;
        line-height:1;
      }

      .news-directory-word {
        display:block;
        font-family:Arial Black, Arial, Helvetica, sans-serif;
        font-size:7px;
        font-weight:900;
        letter-spacing:.02em;
        color:#111;
        line-height:1;
        margin:0 0 1px;
      }

      .news-directory-paper {
        width:23px;
        height:20px;
        display:block;
        position:relative;
        box-sizing:border-box;
        border:2px solid #111;
        border-radius:2px;
        background:#fff;
        box-shadow:inset 0 0 0 1px rgba(0,0,0,.05);
      }

      .news-directory-paper::before {
        content:"";
        position:absolute;
        left:3px;
        top:4px;
        width:7px;
        height:6px;
        background:#111;
        border-radius:1px;
      }

      .news-directory-line {
        position:absolute;
        left:12px;
        right:3px;
        height:2px;
        background:#111;
        border-radius:999px;
      }

      .news-directory-line-wide {
        left:3px;
        right:3px;
        top:12px;
      }

      .news-directory-line:not(.news-directory-line-wide):nth-of-type(2) {
        top:4px;
      }

      .news-directory-line:not(.news-directory-line-wide):nth-of-type(3) {
        top:8px;
      }

      .news-directory-box {
        position:absolute;
        left:3px;
        right:3px;
        bottom:3px;
        height:2px;
        background:#111;
        border-radius:999px;
      }

      .sports-center-link,
      .traffic-center-link {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        color:#111;
        text-decoration:none;
        font-weight:800;
        white-space:nowrap;
        flex:0 0 auto;
        transition:opacity .2s ease;
      }

      .sports-center-link:hover,
      .traffic-center-link:hover {
        opacity:.72;
        text-decoration:none;
      }

      .sports-center-icon,
      .traffic-center-icon {
        width:28px;
        height:28px;
        display:block;
        object-fit:contain;
      }

      .ticker a {
        color:#fff;
        text-decoration:none;
      }

      .ticker a:hover { text-decoration:underline; }

      .ticker {
        background:#000;
        color:#fff;
        padding:9px 20px;
        font-size:13px;
        font-weight:700;
        font-family:Arial, Helvetica, sans-serif;
      }

      .market-ticker-wrap {
        position:relative;
        background:#020711;
        border-top:1px solid rgba(255,255,255,.12);
        border-bottom:1px solid rgba(255,255,255,.12);
        overflow:hidden;
        min-height:46px;
      }

      .market-ticker-click {
        position:absolute;
        inset:0;
        z-index:3;
        display:block;
        text-indent:-9999px;
        overflow:hidden;
      }

      .market-ticker-click:focus {
        outline:2px solid #f2d990;
        outline-offset:-3px;
      }

      .market-ticker-live {
        max-width:1180px;
        margin:0 auto;
        padding:0 20px;
        min-height:46px;
        display:flex;
        align-items:center;
        gap:10px;
        position:relative;
        z-index:1;
      }

      .market-ticker-label {
        flex:0 0 auto;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:5px 8px;
        border:1px solid rgba(214,178,94,.48);
        border-radius:999px;
        background:rgba(7,17,31,.92);
        color:#f2d990;
        font-size:10px;
        font-weight:900;
        letter-spacing:.08em;
        text-transform:uppercase;
        white-space:nowrap;
      }

      .market-tv-ticker {
        flex:1 1 auto;
        min-width:0;
        height:46px;
        overflow:hidden;
      }

      .market-tv-ticker .tradingview-widget-container,
      .market-tv-ticker .tradingview-widget-container__widget {
        width:100%;
        height:46px;
        min-height:46px;
      }

      /* CGN SHELL CHROME CLICK HARDENING — keep global overlays bounded and let page content below remain clickable. */
      .top-bar,
      .ticker,
      .market-ticker-wrap {
        position:relative;
        pointer-events:auto;
      }

      .top-bar {
        z-index:30;
      }

      .ticker {
        z-index:12;
        isolation:isolate;
      }

      .market-ticker-wrap {
        z-index:10;
        height:46px;
        max-height:46px;
        contain:layout paint;
        isolation:isolate;
      }

      .market-ticker-click {
        top:0;
        right:0;
        bottom:0;
        left:0;
        width:100%;
        height:46px;
        max-height:46px;
        pointer-events:auto;
      }

      .market-ticker-live,
      .market-tv-ticker,
      .market-tv-ticker .tradingview-widget-container,
      .market-tv-ticker .tradingview-widget-container__widget,
      .market-tv-ticker iframe {
        pointer-events:none;
      }

      .nav-dropdown,
      .account-menu,
      .account-menu *,
      .nav-dropdown *,
      .top-bar a,
      .top-bar button,
      .ticker a,
      .market-ticker-click,
      .cgn-bureau-weather-time,
      .cgn-ios-app-desktop-link,
      .cgn-ios-app-mobile-link {
        pointer-events:auto;
      }

      .top-bar::before,
      .top-bar::after,
      .ticker::before,
      .ticker::after,
      .market-ticker-wrap::before,
      .market-ticker-wrap::after {
        pointer-events:none;
      }

      .footer {
        background:#0a0a0a;
        color:#fff;
        padding:40px 20px;
        font-family:Arial, Helvetica, sans-serif;
      }

      .footer-container {
        display:grid;
        grid-template-columns:1.2fr 1fr 1fr 1fr 1.25fr;
        max-width:1180px;
        margin:auto;
        gap:28px;
        align-items:start;
      }

      .footer h4 {
        margin:0 0 10px;
      }

      .footer p {
        line-height:1.45;
      }

      .footer-bureau p {
        margin:4px 0;
        color:#ccc;
        line-height:1.42;
      }

      .footer-bureau .footer-bureau-name {
        color:#fff;
        font-weight:800;
      }

      .footer a {
        color:#ccc;
        text-decoration:none;
      }

      .footer a:hover { text-decoration:underline; }

      .footer-logo { width:180px; }

      .footer-bottom {
        text-align:center;
        margin-top:20px;
        color:#aaa;
      }

      .footer-legal-archives {
        display:inline-block;
        margin-top:4px;
        font-weight:700;
      }

      .footer-eo-block {
        max-width:1100px;
        margin:28px auto 0;
        padding:20px 18px 0;
        border-top:1px solid #333;
        text-align:center;
        color:#bdbdbd;
        font-size:12px;
        line-height:1.55;
      }

      .footer-eo-title {
        margin:0 auto 10px;
        max-width:980px;
        color:#bdbdbd;
        font-size:13px;
        font-weight:900;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .footer-eo-copy {
        max-width:980px;
        margin:0 auto 10px;
        text-align:center;
        color:#bdbdbd;
      }

      .footer-eo-copy p {
        margin:0 0 8px;
        color:#bdbdbd;
      }

      .footer-eo-reporting {
        padding-top:6px;
        border-top:1px solid rgba(255,255,255,.10);
      }

      .footer-eo-title a,
      .footer-eo-block a {
        color:#fff;
        text-decoration:none;
      }

      .footer-eo-title a:hover,
      .footer-eo-block a:hover {
        text-decoration:underline;
      }

      .footer-veteran-owned {
        margin:0 auto 10px;
        max-width:980px;
        color:#fff !important;
        font-weight:900;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .footer-utility-links {
        max-width:1100px;
        margin:18px auto 0;
        padding-top:18px;
        border-top:1px solid #333;
        text-align:center;
        color:#aaa;
        font-size:14px;
      }

      .footer-utility-links a {
        color:#ccc;
        text-decoration:none;
        font-weight:700;
      }

      .footer-utility-links a:hover {
        text-decoration:underline;
      }

      .footer-social {
        display:flex;
        gap:12px;
        margin-top:10px;
      }

      .footer .social-icon {
        fill:#fff;
      }

      @media (max-width: 900px) {
        .top-bar {
          flex-direction:column;
          align-items:center;
          text-align:center;
        }

        .logo {
          height:82px;
        }

        .nav {
          flex-wrap:wrap;
          justify-content:center;
          gap:12px;
        }

        .right-tools {
          flex-wrap:wrap;
          justify-content:center;
          gap:12px;
        }

        .network-name {
          font-size:9px;
        }

        .nav-more {
          position:relative;
        }

        .nav-more-button {
          min-width:34px;
          min-height:34px;
          border:1px solid #ddd;
          border-radius:999px;
          background:#fff;
        }

        .nav-dropdown {
          position:absolute;
          top:calc(100% + 8px);
          left:50%;
          right:auto;
          transform:translateX(-50%);
          width:min(260px, calc(100vw - 32px));
          max-width:calc(100vw - 32px);
          z-index:1000;
          text-align:left;
        }

        .news-directory-link,
        .news-directory-icon {
          width:30px;
          height:30px;
        }

        .news-directory-paper {
          width:24px;
          height:21px;
        }

        .news-directory-word {
          font-size:7px;
        }

        .sports-center-icon,
        .traffic-center-icon {
          width:30px;
          height:30px;
        }

        .right-tools {
          width:100%;
          max-width:430px;
          margin:0 auto;
          display:flex;
          flex-wrap:wrap;
          justify-content:space-between;
          align-items:center;
          gap:8px 6px;
          overflow:visible;
        }

        .right-tools > * {
          order:3;
        }

        .account-wrap {
          order:1;
          flex:0 0 100%;
          display:flex;
          justify-content:center;
          position:relative;
        }

        #account-btn {
          min-width:92px;
        }

        .cgn-bureau-weather-time {
          order:2;
          flex:0 0 100%;
          width:100%;
          max-width:none;
          min-width:0;
          align-items:center;
          justify-content:center;
          text-align:center;
          white-space:normal;
          line-height:1.2;
        }

        .cgn-bureau-mobile-line {
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          width:100%;
          max-width:100%;
          color:#111;
          text-align:center;
          white-space:normal;
          overflow:visible;
          gap:1px;
        }

        .cgn-bureau-mobile-date {
          display:block;
          width:100%;
          font-size:17px;
          font-weight:950;
          letter-spacing:.01em;
          line-height:1.12;
        }

        .cgn-bureau-mobile-clock {
          display:block;
          width:100%;
          font-size:16px;
          font-weight:950;
          letter-spacing:.01em;
          line-height:1.12;
        }

        .cgn-bureau-mobile-city {
          display:block;
          width:100%;
          font-size:15px;
          font-weight:950;
          letter-spacing:.02em;
          line-height:1.12;
        }

        .cgn-bureau-time,
        .cgn-bureau-weather,
        .cgn-bureau-location {
          display:none;
        }

        .right-tools > a#cgn-mobile-weather-mini,
        .right-tools > a#news-directory-link,
        .right-tools > a#sports-center-link,
        .right-tools > a#traffic-center-link,
        .right-tools > a.cgn-help-link,
        .right-tools > a[aria-label="CGN News on Instagram"],
        .right-tools > a[aria-label="CGN News on X"],
        .right-tools > a[aria-label="CGN News on YouTube"],
        .right-tools > a.editor-portal-link {
          flex:1 1 0;
          min-width:0;
          display:inline-flex;
          align-items:center;
          justify-content:center;
        }

        .cgn-ios-app-mobile-link {
          display:inline-flex;
          order:4;
        }

        .cgn-ios-app-desktop-link {
          display:none !important;
        }

        .cgn-mobile-weather-mini {
          order:3;
          min-height:32px;
          padding:0;
          margin:0;
          background:transparent;
          border:0;
          color:#111;
          text-decoration:none;
          font-size:20px;
          font-weight:950;
          line-height:1;
          white-space:nowrap;
        }

        .cgn-mobile-weather-compact {
          display:inline-flex;
          align-items:center;
          justify-content:center;
          line-height:1;
          letter-spacing:-.01em;
        }

        .editor-portal-link {
          order:3;
          flex:1 1 0;
          min-width:0;
          min-height:32px;
          margin:0;
          display:inline-flex;
          align-items:center;
          justify-content:center;
        }

        .account-menu {
          left:50%;
          right:auto;
          transform:translateX(-50%);
          top:calc(100% + 8px);
          width:min(190px, calc(100vw - 32px));
          max-width:calc(100vw - 32px);
          z-index:1001;
          text-align:left;
        }

        .editor-portal-link {
          width:auto;
          min-height:32px;
          padding:0;
          gap:0;
          border:0;
          border-radius:0;
          background:transparent;
          font-family:Arial, Helvetica, sans-serif;
          font-size:13px;
          font-weight:900;
          letter-spacing:0;
          line-height:1;
        }

        .editor-portal-text {
          display:none !important;
        }

        .editor-portal-link .editor-portal-pen {
          width:19px;
          height:4px;
        }

        .market-ticker-live {
          padding:0 14px;
          gap:8px;
        }

        .market-ticker-label {
          font-size:9px;
          padding:4px 7px;
        }

        .market-tv-ticker {
          height:46px;
        }

        .footer-container {
          grid-template-columns:1fr;
          text-align:center;
        }

        .footer-social {
          justify-content:center;
        }

        .footer-eo-copy {
          text-align:center;
        }
      }

      /* CGN SHELL FINAL CHROME OVERLAY FIX 03 — keep shell layers bounded only.
         Do not globally force CGN LIVE, .main, .feed, #article-feed, or article-card z-index/pointer behavior here. */
      #cgn-site-header {
        position:relative !important;
        z-index:60 !important;
        isolation:isolate !important;
        pointer-events:auto !important;
      }

      .top-bar,
      .ticker,
      .market-ticker-wrap {
        position:relative !important;
        pointer-events:auto !important;
      }

      .ticker,
      .market-ticker-wrap {
        overflow:hidden !important;
        contain:layout paint !important;
      }

      .market-ticker-wrap {
        height:46px !important;
        min-height:46px !important;
        max-height:46px !important;
        z-index:10 !important;
        isolation:isolate !important;
      }

      .market-ticker-click {
        position:absolute !important;
        inset:0 !important;
        width:100% !important;
        height:46px !important;
        max-height:46px !important;
        z-index:3 !important;
        pointer-events:auto !important;
      }

      .market-ticker-live,
      .market-tv-ticker,
      .market-tv-ticker .tradingview-widget-container,
      .market-tv-ticker .tradingview-widget-container__widget,
      .market-tv-ticker iframe {
        pointer-events:none !important;
      }

      .nav-dropdown,
      .account-menu,
      .account-menu *,
      .nav-dropdown *,
      .top-bar a,
      .top-bar button,
      .ticker a,
      .market-ticker-click,
      .cgn-bureau-weather-time,
      .sports-center-link,
      .traffic-center-link,
      .cgn-ios-app-mobile-link,
      .cgn-ios-app-desktop-link {
        pointer-events:auto !important;
      }

    `;

    document.head.appendChild(style);
  }

  document.addEventListener("click", function(event){
    const accountWrap = document.querySelector(".account-wrap");
    const accountMenu = document.getElementById("account-menu");

    if(accountWrap && accountMenu && !accountWrap.contains(event.target)){
      accountMenu.classList.remove("open");
    }

    const navMore = document.querySelector(".nav-more");
    if(navMore && !navMore.contains(event.target)){
      navMore.classList.remove("open");
    }
  });

  document.addEventListener("keydown", function(event){
    if(event.key === "Escape"){
      const accountMenu = document.getElementById("account-menu");
      if(accountMenu) accountMenu.classList.remove("open");

      const navMore = document.querySelector(".nav-more");
      if(navMore) navMore.classList.remove("open");

      closeShellLogin();
    }
  });

  function initShell(){
    publishAccountLoginGlobals();
    injectStyles();
    renderHeader();
    renderFooter();
    renderShellLoginModal();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initShell);
  } else {
    initShell();
  }

})();
