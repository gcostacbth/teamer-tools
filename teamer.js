(function () {
  // ==== Singleton guard ====
  if (window.__teamerToolkit && window.__teamerToolkit.loaded) {
    console.log("⚠️ TeamerToolkit ya estaba cargado");
    return;
  }
  window.__teamerToolkit = { loaded: true };

  // ==== Config ====
  const CONFIG = {
    selector: "#TeamerHeader span",
    highlight: {
      backgroundColor: "yellow",
      padding: "2px 4px",
      borderRadius: "4px",
      outline: "2px solid orange",
    },
    debug: false,
    maxNetworkLog: 5000,
    maxBodyBytes:  512_000,
    apiTimeoutMs: 10000,
    skipExtensions: /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map|webp|avif)(\?|$)/i,
    dashboardApi: "https://api.pro.internal.caixabank.com",
    dashPageSize: 3000,  // la API devolverá lo que acepte; se ajusta automáticamente
  };

  const state = {
    observer: null,
    network: [],
    byPattern: {},
    startedAt: new Date().toISOString(),
    origFetch: window.fetch ? window.fetch.bind(window) : null,
    origXHROpen: XMLHttpRequest.prototype.open,
    origXHRSend: XMLHttpRequest.prototype.send,
    origXHRSetRH: XMLHttpRequest.prototype.setRequestHeader,
    ui: { panel: null, output: null, endpointInput: null },
    dash: { overlay: null, items: [], loading: false, cancel: false },
  };

  function log(...args) {
    if (CONFIG.debug) console.log("[TeamerToolkit]", ...args);
  }

  // ==== Highlight ====
  function getUserElement() { return document.querySelector(CONFIG.selector); }

  function applyHighlight() {
    const el = getUserElement();
    if (el && !el.dataset.ttHl) {
      Object.assign(el.style, CONFIG.highlight);
      el.dataset.ttHl = "1";
      log("✅ Highlight aplicado:", el.innerText);
    }
    return el;
  }

  // ==== Utilities ====
  function nowIso()   { return new Date().toISOString(); }
  function safeText(x){ try { return typeof x === "string" ? x : JSON.stringify(x, null, 2); } catch { return String(x); } }
  function setOutput(text) { if (state.ui.output) state.ui.output.textContent = text; else console.log(text); }
  async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); alert("✅ Copiado al portapapeles"); }
    catch (e) { alert("❌ No se pudo copiar. Mira consola."); console.error(e); }
  }
  function truncateBody(str) {
    if (!str || str.length <= CONFIG.maxBodyBytes) return str;
    return str.slice(0, CONFIG.maxBodyBytes) + `\n…[TRUNCADO: ${str.length - CONFIG.maxBodyBytes} bytes]`;
  }
  function tryParseJson(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return str; }
  }
  function shouldSkip(url) { return CONFIG.skipExtensions.test(url); }
  function normalizePattern(rawUrl) {
    try {
      const u = new URL(rawUrl, location.origin);
      const path = u.pathname
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/{uuid}")
        .replace(/\/\d{5,}/g, "/{id}")
        .replace(/\/[A-Z]{2,}-?\d{3,}/g, "/{ref}");
      return u.origin + path;
    } catch { return rawUrl; }
  }
  function extractQueryParams(rawUrl) {
    try { const p = {}; new URL(rawUrl, location.origin).searchParams.forEach((v,k) => p[k]=v); return p; }
    catch { return {}; }
  }

  // ==== Store network entry ====
  function pushNetwork(entry) {
    if (shouldSkip(entry.url)) return;
    const pattern = normalizePattern(entry.url);
    entry.pattern = pattern;
    if (state.network.length >= CONFIG.maxNetworkLog) state.network.shift();
    state.network.unshift(entry);
    if (!state.byPattern[pattern]) {
      state.byPattern[pattern] = { pattern, method: entry.method, count:0, errors:0, totalMs:0, statusCodes:{}, queryParamKeys: new Set(), examples:[] };
    }
    const ep = state.byPattern[pattern];
    ep.count++; ep.totalMs += entry.ms || 0;
    const sc = entry.status || 0;
    ep.statusCodes[sc] = (ep.statusCodes[sc] || 0) + 1;
    if (sc >= 400 || sc === "ERR") ep.errors++;
    Object.keys(extractQueryParams(entry.url)).forEach(k => ep.queryParamKeys.add(k));
    ep.examples.push(entry);
    renderNetwork();
  }

  // ==== Network intercept ====
  function installNetworkHooks() {
    if (state.origFetch) {
      window.fetch = async function (input, init = {}) {
        const start  = performance.now();
        const method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
        const url    = typeof input === "string" ? input : (input && input.url) ? input.url : String(input);
        const reqHeaders = {};
        try {
          const h = (init && init.headers) || (input && input.headers);
          if (h instanceof Headers) h.forEach((v, k) => { reqHeaders[k] = v; });
          else if (h) Object.assign(reqHeaders, h);
        } catch {}
        let reqBody = null;
        if (init && init.body) {
          try { reqBody = typeof init.body === "string" ? tryParseJson(init.body) : "[non-string body]"; }
          catch { reqBody = "[parse error]"; }
        }
        let res;
        try {
          res = await state.origFetch(input, init);
        } catch (err) {
          pushNetwork({ ts: nowIso(), type:"fetch", method, url, status:"ERR", ms: Math.round(performance.now()-start), reqHeaders, reqBody, resHeaders:{}, resBody: String(err), error: String(err) });
          throw err;
        }
        const ms = Math.round(performance.now() - start);
        const resHeaders = {};
        res.headers.forEach((v,k) => { resHeaders[k] = v; });
        res.clone().text().then(text => {
          pushNetwork({ ts: nowIso(), type:"fetch", method, url, status: res.status, ms, reqHeaders, reqBody, resHeaders, resBody: tryParseJson(truncateBody(text)), queryParams: extractQueryParams(url) });
        }).catch(() => {
          pushNetwork({ ts: nowIso(), type:"fetch", method, url, status: res.status, ms, reqHeaders, reqBody, resHeaders, resBody: null, queryParams: extractQueryParams(url) });
        });
        return res;
      };
    }

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__tt = { method: (method||"GET").toUpperCase(), url: String(url), start:0, reqHeaders:{} };
      return state.origXHROpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
      if (this.__tt) this.__tt.reqHeaders[name] = value;
      return state.origXHRSetRH.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      if (this.__tt) {
        this.__tt.start = performance.now();
        if (body) {
          try { this.__tt.reqBody = typeof body === "string" ? tryParseJson(body) : "[non-string body]"; }
          catch { this.__tt.reqBody = "[parse error]"; }
        }
        this.addEventListener("loadend", function () {
          if (!this.__tt) return;
          const ms = Math.round(performance.now() - this.__tt.start);
          const resHeaders = {};
          try { this.getAllResponseHeaders().split("\r\n").filter(Boolean).forEach(line => { const i=line.indexOf(": "); if(i>-1) resHeaders[line.slice(0,i).toLowerCase()]=line.slice(i+2); }); } catch {}
          pushNetwork({ ts: nowIso(), type:"xhr", method: this.__tt.method, url: this.__tt.url, status: this.status, ms, reqHeaders: this.__tt.reqHeaders||{}, reqBody: this.__tt.reqBody||null, resHeaders, resBody: tryParseJson(truncateBody(this.responseText)), queryParams: extractQueryParams(this.__tt.url) });
        });
      }
      return state.origXHRSend.apply(this, arguments);
    };
    log("✅ Network hooks instalados");
  }

  function uninstallNetworkHooks() {
    if (state.origFetch) window.fetch = state.origFetch;
    XMLHttpRequest.prototype.open = state.origXHROpen;
    XMLHttpRequest.prototype.send = state.origXHRSend;
    XMLHttpRequest.prototype.setRequestHeader = state.origXHRSetRH;
    log("🧹 Network hooks restaurados");
  }

  // ==== Token helper ====
  function getAuth() {
    for (const c of state.network) {
      const auth = c.reqHeaders?.Authorization || c.reqHeaders?.authorization;
      if (auth) return auth;
    }
    return null;
  }

  // ==== API caller (direct call) ====
  async function apiCall(pathOrUrl) {
    const url = normalizeUrl(pathOrUrl);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), CONFIG.apiTimeoutMs);
    try {
      const res = await fetch(url, { method:"GET", credentials:"include", headers:{"Accept":"application/json, text/plain, */*"}, signal: controller.signal });
      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json") ? await res.json() : await res.text();
      setOutput(`GET ${url}\nStatus: ${res.status}\nContent-Type: ${ct}\n\n` + safeText(body));
    } catch (e) {
      setOutput(`❌ Error llamando ${url}\n${String(e)}`);
    } finally { clearTimeout(t); }
  }

  function normalizeUrl(pathOrUrl) {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    return window.location.origin + (pathOrUrl.startsWith("/") ? pathOrUrl : "/" + pathOrUrl);
  }

  // ==== Export ====
  function tsStamp() { return new Date().toISOString().slice(0,19).replace(/[:.]/g,"-"); }
  function saveFile(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type:"application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  function describeShape(val, depth) {
    if (depth > 4) return "…";
    if (val === null) return "null";
    if (Array.isArray(val)) return val.length ? [describeShape(val[0], depth+1)] : [];
    if (typeof val === "object") { const o={}; Object.keys(val).slice(0,40).forEach(k=>o[k]=describeShape(val[k],depth+1)); return o; }
    return typeof val;
  }
  function buildAnalysis() {
    const endpoints = Object.values(state.byPattern).map(ep => ({
      pattern: ep.pattern, method: ep.method, count: ep.count, errors: ep.errors,
      avgMs: ep.count ? Math.round(ep.totalMs/ep.count) : 0,
      statusCodes: ep.statusCodes, queryParamKeys: [...ep.queryParamKeys],
      responseSchema: (ex => { const s=ex.find(e=>e.status>=200&&e.status<300&&e.resBody&&typeof e.resBody==="object"); return s?describeShape(s.resBody,0):null; })(ep.examples),
      examples: ep.examples.filter(e=>e.status>=200&&e.status<300).slice(0,5),
    }));
    endpoints.sort((a,b) => b.count-a.count);
    return { meta:{ capturedAt: new Date().toISOString(), startedAt: state.startedAt, pageOrigin: location.origin, pageTitle: document.title, totalCalls: state.network.length, endpoints: endpoints.length }, endpoints };
  }
  function buildRaw() {
    return { meta:{ capturedAt: new Date().toISOString(), startedAt: state.startedAt, pageOrigin: location.origin, pageTitle: document.title, totalCalls: state.network.length },
      calls: [...state.network].reverse().map(c=>({ ts:c.ts, type:c.type, method:c.method, url:c.url, pattern:c.pattern, status:c.status, ms:c.ms, queryParams:c.queryParams||{}, reqHeaders:c.reqHeaders||{}, reqBody:c.reqBody||null, resHeaders:c.resHeaders||{}, resBody:c.resBody||null })) };
  }
  function doExport() {
    const stamp = tsStamp(), analysis = buildAnalysis(), raw = buildRaw();
    saveFile(analysis, `tt-analysis-${stamp}.json`);
    setTimeout(() => saveFile(raw, `tt-raw-${stamp}.json`), 400);
    setOutput(`✅ Exportados:\n  tt-analysis-${stamp}.json (${analysis.meta.endpoints} endpoints)\n  tt-raw-${stamp}.json (${raw.meta.totalCalls} llamadas)`);
  }

  // ==================================================================
  // ==== DASHBOARD OVERLAY ==========================================
  // ==================================================================

  const DB_STYLE = `
  #tt-dashboard{position:fixed;inset:0;z-index:2147483640;background:#f0f2f5;font-family:'Segoe UI',system-ui,sans-serif;color:#000026;overflow-y:auto;display:flex;flex-direction:column}
  .ttdb-header{background:#fff;border-bottom:2px solid #dde3e8;padding:12px 24px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;flex-shrink:0}
  .ttdb-title{font-size:17px;font-weight:800;letter-spacing:-.5px}
  .ttdb-sub{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#8a9bb0;margin-top:1px}
  .ttdb-pill{font-size:9px;padding:3px 9px;border-radius:20px;font-weight:700;background:rgba(0,196,233,.12);color:#00C4E9;border:1px solid rgba(0,196,233,.25)}
  .ttdb-pill-demo{background:rgba(244,197,61,.15);color:#b45309;border:1px solid rgba(244,197,61,.4)}
  .ttdb-live{display:flex;align-items:center;gap:5px;font-size:9px;color:#8a9bb0}
  .ttdb-dot{width:6px;height:6px;border-radius:50%;background:#00CFB9;animation:ttdb-blink 2s infinite}
  @keyframes ttdb-blink{0%,100%{opacity:1}50%{opacity:.25}}
  .ttdb-btn{font-size:11px;font-weight:700;padding:6px 14px;border:none;border-radius:8px;cursor:pointer;transition:all .2s;white-space:nowrap}
  .ttdb-btn-close{background:#f5f7f9;color:#2c3050;border:1px solid #dde3e8}
  .ttdb-btn-close:hover{border-color:#c2cdd6}
  .ttdb-btn-primary{background:#00C4E9;color:#fff}
  .ttdb-btn-primary:hover{background:#009bba}

  .ttdb-loading{background:#fff;border-bottom:1px solid #dde3e8;padding:10px 24px;display:none;align-items:center;gap:12px;font-size:11px;color:#8a9bb0;flex-shrink:0}
  .ttdb-loading.on{display:flex}
  .ttdb-spinner{width:14px;height:14px;border:2px solid #dde3e8;border-top-color:#00C4E9;border-radius:50%;animation:ttdb-spin .9s linear infinite;flex-shrink:0}
  @keyframes ttdb-spin{to{transform:rotate(360deg)}}
  .ttdb-ltrack{flex:1;height:4px;background:#edf0f3;border-radius:2px;overflow:hidden}
  .ttdb-lfill{height:100%;background:linear-gradient(90deg,#00C4E9,#7c3aed);border-radius:2px;transition:width .4s}

  .ttdb-err{display:none;margin:16px 24px;padding:12px 16px;background:rgba(232,62,140,.05);border:1px solid rgba(232,62,140,.2);border-radius:10px;color:#e83e8c;font-size:12px;flex-shrink:0}
  .ttdb-err.on{display:block}

  .ttdb-main{padding:18px 24px;display:flex;flex-direction:column;gap:14px;flex:1}

  .ttdb-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
  .ttdb-kcard{background:#fff;border:1px solid #dde3e8;border-radius:10px;padding:14px 16px;position:relative;overflow:hidden}
  .ttdb-kcard::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:10px 0 0 10px}
  .ttdb-kc-acc::before{background:#00C4E9} .ttdb-kc-pur::before{background:#7c3aed} .ttdb-kc-grn::before{background:#00CFB9} .ttdb-kc-amb::before{background:#f4c53d} .ttdb-kc-rose::before{background:#e83e8c}
  .ttdb-kl{font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:#8a9bb0;font-weight:700;margin-bottom:6px}
  .ttdb-kv{font-size:26px;font-weight:800;line-height:1;letter-spacing:-1px}
  .ttdb-kc-acc .ttdb-kv{color:#00C4E9} .ttdb-kc-pur .ttdb-kv{color:#7c3aed} .ttdb-kc-grn .ttdb-kv{color:#00CFB9} .ttdb-kc-amb .ttdb-kv{color:#f4c53d} .ttdb-kc-rose .ttdb-kv{color:#e83e8c}
  .ttdb-ksub{font-size:10px;color:#8a9bb0;margin-top:4px}

  .ttdb-card{background:#fff;border:1px solid #dde3e8;border-radius:10px;padding:14px 18px}
  .ttdb-card-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.3px;color:#8a9bb0;margin-bottom:12px;display:flex;align-items:center;gap:8px}
  .ttdb-card-title span{color:#2c3050}

  .ttdb-row2{display:grid;grid-template-columns:1fr 1fr;gap:14px}

  .ttdb-legend{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px}
  .ttdb-leg{display:flex;align-items:center;gap:5px;font-size:10px;color:#8a9bb0}
  .ttdb-leg-dot{width:10px;height:10px;border-radius:2px;flex-shrink:0}

  .ttdb-tabs{display:flex;gap:4px;margin-left:auto}
  .ttdb-tab{font-size:9px;font-weight:700;padding:3px 9px;border-radius:5px;cursor:pointer;border:1px solid #dde3e8;background:#f5f7f9;color:#8a9bb0;transition:all .15s}
  .ttdb-tab.active{background:#00C4E9;color:#fff;border-color:#00C4E9}

  .ttdb-chart-scroll{overflow-x:auto}

  .ttdb-donut-wrap{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
  .ttdb-dlegend{display:flex;flex-direction:column;gap:7px;flex:1}
  .ttdb-dl{display:flex;align-items:center;gap:7px;font-size:11px;color:#2c3050}
  .ttdb-dl-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
  .ttdb-dl-val{font-weight:700;margin-left:auto;font-size:12px}

  .ttdb-type-row{display:flex;align-items:center;gap:8px;margin-bottom:7px;font-size:10px}
  .ttdb-type-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#2c3050;min-width:0}
  .ttdb-type-bar-wrap{width:100px;flex-shrink:0;height:5px;background:#edf0f3;border-radius:3px;overflow:hidden}
  .ttdb-type-bar-fill{height:100%;border-radius:3px;background:#7c3aed;transition:width .5s}
  .ttdb-type-count{width:32px;text-align:right;font-weight:700;color:#8a9bb0;flex-shrink:0}
  `;

  function injectDashboardStyle() {
    if (document.getElementById("tt-dashboard-style")) return;
    const s = document.createElement("style");
    s.id = "tt-dashboard-style";
    s.textContent = DB_STYLE;
    document.head.appendChild(s);
  }

  function openDashboard() {
    if (document.getElementById("tt-dashboard")) return;
    injectDashboardStyle();

    const ov = document.createElement("div");
    ov.id = "tt-dashboard";
    ov.innerHTML = `
      <div class="ttdb-header">
        <div>
          <div class="ttdb-title">Teamer · Volumetría</div>
          <div class="ttdb-sub">Consultas &amp; Peticiones · BIS v1</div>
        </div>
        <span class="ttdb-pill" id="ttdb-mode">LIVE</span>
        <span id="ttdb-period" style="font-size:9px;padding:3px 9px;border-radius:20px;background:#f5f7f9;color:#8a9bb0;border:1px solid #dde3e8"></span>
        <div class="ttdb-live" style="margin-left:auto"><div class="ttdb-dot"></div><span>api.pro.internal.caixabank.com</span></div>
        <div style="display:flex;gap:6px">
          <button class="ttdb-btn ttdb-btn-primary" id="ttdb-btn-demo" onclick="window.__teamerToolkit._dashDemo()">Demo</button>
          <button class="ttdb-btn ttdb-btn-close" onclick="window.__teamerToolkit._dashClose()">✕ Cerrar</button>
        </div>
      </div>

      <div class="ttdb-loading" id="ttdb-loading">
        <div class="ttdb-spinner"></div>
        <span id="ttdb-loading-text">Cargando…</span>
        <div class="ttdb-ltrack"><div class="ttdb-lfill" id="ttdb-lfill" style="width:0%"></div></div>
        <span id="ttdb-lpc" style="flex-shrink:0;min-width:38px;text-align:right;font-size:10px">0%</span>
        <button class="ttdb-btn ttdb-btn-close" style="padding:3px 8px;font-size:10px" id="ttdb-cancel-btn" onclick="window.__teamerToolkit._dashCancel()">Cancelar</button>
      </div>

      <div class="ttdb-err" id="ttdb-err"></div>

      <div class="ttdb-main" id="ttdb-main" style="display:none">
        <div class="ttdb-kpis" id="ttdb-kpis"></div>

        <div class="ttdb-card">
          <div class="ttdb-card-title">
            <span>Volumen mensual</span>
            <div class="ttdb-tabs">
              <div class="ttdb-tab active" onclick="window.__teamerToolkit._dashWindow(12,this)">12m</div>
              <div class="ttdb-tab" onclick="window.__teamerToolkit._dashWindow(6,this)">6m</div>
              <div class="ttdb-tab" onclick="window.__teamerToolkit._dashWindow(3,this)">3m</div>
            </div>
          </div>
          <div class="ttdb-legend">
            <div class="ttdb-leg"><div class="ttdb-leg-dot" style="background:#00C4E9"></div>Consultas</div>
            <div class="ttdb-leg"><div class="ttdb-leg-dot" style="background:#7c3aed"></div>Peticiones</div>
          </div>
          <div class="ttdb-chart-scroll"><svg id="ttdb-bar" style="display:block;width:100%;min-width:480px" height="200"></svg></div>
        </div>

        <div class="ttdb-row2">
          <div class="ttdb-card">
            <div class="ttdb-card-title"><span>Estado</span></div>
            <div class="ttdb-donut-wrap">
              <svg id="ttdb-donut" width="100" height="100" viewBox="0 0 100 100" style="flex-shrink:0">
                <circle cx="50" cy="50" r="36" fill="none" stroke="#edf0f3" stroke-width="16"/>
                <g id="ttdb-donut-arcs"></g>
                <text x="50" y="46" text-anchor="middle" font-size="14" font-weight="800" fill="#000026" id="ttdb-donut-total">—</text>
                <text x="50" y="58" text-anchor="middle" font-size="7" fill="#8a9bb0">total</text>
              </svg>
              <div class="ttdb-dlegend" id="ttdb-dlegend"></div>
            </div>
          </div>
          <div class="ttdb-card">
            <div class="ttdb-card-title">
              <span>Top tipos</span>
              <div class="ttdb-tabs">
                <div class="ttdb-tab active" onclick="window.__teamerToolkit._dashTypeFilter('all',this)">Todos</div>
                <div class="ttdb-tab" onclick="window.__teamerToolkit._dashTypeFilter('consulta',this)">Consultas</div>
                <div class="ttdb-tab" onclick="window.__teamerToolkit._dashTypeFilter('peticion',this)">Peticiones</div>
              </div>
            </div>
            <div id="ttdb-types"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(ov);
    state.dash.overlay  = ov;
    state.dash.windowM  = 12;
    state.dash.typeFilter = "all";
    state.dash.items    = [];

    loadDashData();
  }

  function closeDashboard() {
    state.dash.cancel = true;
    const ov = document.getElementById("tt-dashboard");
    if (ov) ov.remove();
    state.dash.overlay = null;
  }

  // ── Dashboard data loading ──────────────────────────────────────────

  // Espera hasta que aparezca un token más nuevo que `oldAuth` en el network log.
  // El portal renueva el JWT en background (telemetría, polls) cada pocos segundos.
  function waitForFreshToken(oldAuth, timeoutMs = 20000) {
    return new Promise(resolve => {
      const start = Date.now();
      const iv = setInterval(() => {
        const fresh = getAuth();
        if (fresh && fresh !== oldAuth) { clearInterval(iv); resolve(fresh); return; }
        if (Date.now() - start > timeoutMs) { clearInterval(iv); resolve(null); }
      }, 500);
    });
  }

  async function dashApiFetch(path, params) {
    const qs  = new URLSearchParams(params).toString();
    const url = `${CONFIG.dashboardApi}${path}${qs ? "?" + qs : ""}`;

    let auth = getAuth();
    for (let attempt = 0; attempt < 4; attempt++) {
      const headers = { "Accept": "application/json" };
      if (auth) headers["Authorization"] = auth;
      const res = await (state.origFetch || fetch)(url, { credentials: "include", headers });

      if (res.status === 401 || res.status === 403) {
        if (attempt < 3) {
          dashSetLoading(true, `Token expirado — esperando renovación del portal… (${attempt + 1}/3)`, null);
          const fresh = await waitForFreshToken(auth, 20000);
          if (!fresh) throw new Error("No se pudo renovar el token — recarga la página del portal");
          auth = fresh;
          continue;
        }
        throw new Error(`${res.status} — token inválido tras 3 intentos de renovación`);
      }

      if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
      return res.json();
    }
  }

  function dashSetLoading(on, text, pct) {
    const el = document.getElementById("ttdb-loading");
    if (!el) return;
    el.classList.toggle("on", on);
    if (on) {
      document.getElementById("ttdb-loading-text").textContent = text || "…";
      document.getElementById("ttdb-lfill").style.width = (pct || 0) + "%";
      document.getElementById("ttdb-lpc").textContent   = (pct || 0) + "%";
    }
  }

  function dashShowErr(msg) {
    const el = document.getElementById("ttdb-err");
    if (el) { el.textContent = msg; el.classList.add("on"); }
  }

  async function loadDashData() {
    state.dash.cancel = false;
    state.dash.items  = [];
    const main = document.getElementById("ttdb-main");
    const err  = document.getElementById("ttdb-err");
    if (main) main.style.display = "none";
    if (err)  err.classList.remove("on");

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 13);
    cutoff.setDate(1); cutoff.setHours(0,0,0,0);

    let page = 0, done = false, totalPages = null;
    dashSetLoading(true, "Cargando procesos…", 0);

    try {
      while (!done && !state.dash.cancel) {
        const data = await dashApiFetch("/devops/bis/1/my-processes", { user:"*", page, size: CONFIG.dashPageSize });
        // La API puede devolver menos elementos de los pedidos — ajustar el tamaño real
        if (totalPages === null) {
          const actualSize = data.size || CONFIG.dashPageSize;
          if (actualSize < CONFIG.dashPageSize) CONFIG.dashPageSize = actualSize;
          totalPages = data.totalPages;
        }

        for (const item of (data.content || [])) {
          const d = new Date(item.processInitDate);
          if (d < cutoff) { done = true; break; }
          state.dash.items.push({
            month:    d.toISOString().slice(0, 7),
            category: (item.categoryDescription || "").trim(),
            typeDesc: item.requestTypeDescription || "",
            status:   item.processStatus || "",
          });
        }

        page++;
        if (data.last) done = true;

        const pct = totalPages ? Math.min(95, Math.round(page / Math.min(totalPages, page + 50) * 100)) : 50;
        dashSetLoading(true, `Página ${page}${totalPages ? " / ~"+totalPages : ""} · ${state.dash.items.length} procesos`, pct);
        await new Promise(r => setTimeout(r, 0));
      }

      dashSetLoading(false);
      if (!state.dash.cancel) dashRender();
    } catch (e) {
      dashSetLoading(false);
      dashShowErr("Error: " + e.message + " — comprueba que el token de sesión sigue activo.");
      console.error("[TeamerToolkit/Dashboard]", e);
    }
  }

  // ── Demo data ──────────────────────────────────────────────────────
  function loadDashDemo() {
    const modePill = document.getElementById("ttdb-mode");
    if (modePill) { modePill.textContent = "DEMO"; modePill.classList.add("ttdb-pill-demo"); }
    state.dash.cancel = true;
    state.dash.items  = [];
    const cats  = ["Consultas","Ticketing (Nuevo SAI)","Operación","Aprovisionamiento de Infraestructura","Ciclo de vida de aplicación","Plataforma Cognitiva"];
    const types = ["Realizar nueva consulta","Petición Squad 4","Petición ALM - Product Squad","Solicitud Arquitectura","Service Management","Baja de Aplicación","Alta de acceso","Petición Ciclo de Vida","Operación BBDD","Plataforma Cognitiva"];
    const sts   = ["InProgress","InProgress","InProgress","Cancelled","Expired"];
    const now   = new Date();
    for (let m = 0; m < 13; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const month = d.toISOString().slice(0, 7);
      const vol = 60 + Math.round(Math.random() * 80) + (m < 3 ? 20 : 0);
      for (let i = 0; i < vol; i++) {
        const cat = Math.random() < 0.38 ? cats[0] : cats[1 + Math.floor(Math.random() * 5)];
        state.dash.items.push({ month, category: cat, typeDesc: "[" + (40000+Math.floor(Math.random()*5000)) + "] " + types[Math.floor(Math.random()*types.length)], status: sts[Math.floor(Math.random()*sts.length)] });
      }
    }
    dashSetLoading(false);
    dashRender();
  }

  // ── Render ─────────────────────────────────────────────────────────
  function dashRender() {
    const main = document.getElementById("ttdb-main");
    if (!main) return;
    main.style.display = "";

    const months  = dashBuildMonths(state.dash.windowM);
    const inWin   = state.dash.items.filter(i => months.includes(i.month));

    dashRenderKPIs(inWin);
    dashRenderBar(months, inWin);
    dashRenderDonut(inWin);
    dashRenderTypes(inWin);

    const period = document.getElementById("ttdb-period");
    if (period) period.textContent = months[0] + " → " + months[months.length-1];
  }

  function dashBuildMonths(n) {
    const months = [], d = new Date();
    for (let i = n-1; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth()-i, 1);
      months.push(m.toISOString().slice(0,7));
    }
    return months;
  }

  function isConsulta(item) { return item.category === "Consultas"; }
  function fmtN(n)  { return n >= 1000 ? (n/1000).toFixed(1)+"k" : String(n); }
  function pctN(a,b){ return b ? Math.round(a/b*100) : 0; }

  function dashRenderKPIs(items) {
    const el = document.getElementById("ttdb-kpis");
    if (!el) return;
    const total = items.length, cons = items.filter(isConsulta).length, pet = total - cons;
    const inp   = items.filter(i=>i.status==="InProgress").length;
    const exp   = items.filter(i=>i.status==="Expired").length;
    el.innerHTML = `
      <div class="ttdb-kcard ttdb-kc-acc"><div class="ttdb-kl">Total</div><div class="ttdb-kv">${fmtN(total)}</div><div class="ttdb-ksub">en el periodo</div></div>
      <div class="ttdb-kcard ttdb-kc-pur"><div class="ttdb-kl">Peticiones</div><div class="ttdb-kv">${fmtN(pet)}</div><div class="ttdb-ksub">${pctN(pet,total)}% del total</div></div>
      <div class="ttdb-kcard ttdb-kc-grn"><div class="ttdb-kl">Consultas</div><div class="ttdb-kv">${fmtN(cons)}</div><div class="ttdb-ksub">${pctN(cons,total)}% del total</div></div>
      <div class="ttdb-kcard ttdb-kc-amb"><div class="ttdb-kl">En progreso</div><div class="ttdb-kv">${fmtN(inp)}</div><div class="ttdb-ksub">activos</div></div>
      <div class="ttdb-kcard ttdb-kc-rose"><div class="ttdb-kl">Vencidos</div><div class="ttdb-kv">${fmtN(exp)}</div><div class="ttdb-ksub">${pctN(exp,total)}%</div></div>
    `;
  }

  function dashRenderBar(months, items) {
    const svg = document.getElementById("ttdb-bar");
    if (!svg) return;
    const byM = {};
    months.forEach(m => { byM[m] = {c:0,p:0}; });
    items.forEach(i => { if (byM[i.month]) { isConsulta(i) ? byM[i.month].c++ : byM[i.month].p++; } });

    const maxVal = Math.max(1, ...months.map(m => byM[m].c + byM[m].p));
    const H=200, padT=8, padB=30, padL=36, padR=8, chartH=H-padT-padB;
    const W = svg.parentElement.clientWidth || 700;
    svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
    const n = months.length, step = (W-padL-padR)/n;
    const barW = Math.max(8, step - 4);
    const mNames = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    let out = "";

    for (let t=0; t<=4; t++) {
      const y = padT + chartH - (t/4)*chartH;
      out += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="#dde3e8" stroke-width="1"/>`;
      out += `<text x="${padL-4}" y="${y+3}" text-anchor="end" font-size="8" fill="#8a9bb0">${Math.round(t/4*maxVal)}</text>`;
    }

    months.forEach((m, i) => {
      const x = padL + i*step + (step-barW)/2;
      const {c,p} = byM[m], tot = c+p;
      const fullH = tot/maxVal*chartH, cH = c/maxVal*chartH, pH = p/maxVal*chartH;
      if (pH>0) out += `<rect x="${x}" y="${padT+chartH-pH}" width="${barW}" height="${pH}" fill="#7c3aed" rx="2"/>`;
      if (cH>0) out += `<rect x="${x}" y="${padT+chartH-fullH}" width="${barW}" height="${cH}" fill="#00C4E9" rx="2"/>`;
      const mNum = parseInt(m.slice(5));
      out += `<text x="${x+barW/2}" y="${H-14}" text-anchor="middle" font-size="8" fill="#8a9bb0">${mNames[mNum]}</text>`;
      out += `<text x="${x+barW/2}" y="${H-4}" text-anchor="middle" font-size="7" fill="#c2cdd6">${m.slice(2,4)}</text>`;
      if (barW>16 && tot>0) out += `<text x="${x+barW/2}" y="${padT+chartH-fullH-3}" text-anchor="middle" font-size="7" fill="#8a9bb0">${tot}</text>`;
    });
    svg.innerHTML = out;
  }

  function dashRenderDonut(items) {
    const arcsEl = document.getElementById("ttdb-donut-arcs");
    const legEl  = document.getElementById("ttdb-dlegend");
    const totEl  = document.getElementById("ttdb-donut-total");
    if (!arcsEl) return;
    const counts = { InProgress:0, Cancelled:0, Expired:0 };
    items.forEach(i => { if (counts[i.status]!==undefined) counts[i.status]++; });
    const total = items.length || 1;
    const colors = { InProgress:"#00C4E9", Cancelled:"#f4c53d", Expired:"#e83e8c" };
    const labels = { InProgress:"En progreso", Cancelled:"Cancelado", Expired:"Vencido" };
    const r=36, cx=50, cy=50, circ=2*Math.PI*r;
    let offset=0, arcs="";
    for (const [k,v] of Object.entries(counts)) {
      const dash = v/total*circ;
      arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors[k]}" stroke-width="16" stroke-dasharray="${dash} ${circ-dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += dash;
    }
    arcsEl.innerHTML = arcs;
    totEl.textContent = fmtN(items.length);
    legEl.innerHTML = Object.entries(counts).map(([k,v]) =>
      `<div class="ttdb-dl"><div class="ttdb-dl-dot" style="background:${colors[k]}"></div><span>${labels[k]}</span><span class="ttdb-dl-val">${fmtN(v)}<span style="font-weight:400;color:#8a9bb0;font-size:9px"> (${pctN(v,items.length)}%)</span></span></div>`
    ).join("");
  }

  function dashRenderTypes(items) {
    const el = document.getElementById("ttdb-types");
    if (!el) return;
    const f = state.dash.typeFilter === "consulta" ? items.filter(isConsulta)
            : state.dash.typeFilter === "peticion"  ? items.filter(i=>!isConsulta(i))
            : items;
    const tc = {};
    f.forEach(i => { const d = i.typeDesc.replace(/^\[\d+\]\s*/,"").trim() || "(sin tipo)"; tc[d]=(tc[d]||0)+1; });
    const top = Object.entries(tc).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const maxT = top[0]?.[1] || 1;
    el.innerHTML = top.map(([name,count]) =>
      `<div class="ttdb-type-row">
        <div class="ttdb-type-name" title="${name.replace(/"/g,"&quot;")}">${name.replace(/</g,"&lt;")}</div>
        <div class="ttdb-type-bar-wrap"><div class="ttdb-type-bar-fill" style="width:${Math.round(count/maxT*100)}%"></div></div>
        <div class="ttdb-type-count">${fmtN(count)}</div>
      </div>`
    ).join("") || `<div style="text-align:center;padding:20px;color:#8a9bb0;font-size:11px">Sin datos</div>`;
  }

  // ── Public dashboard controls ──────────────────────────────────────
  window.__teamerToolkit._dashClose      = closeDashboard;
  window.__teamerToolkit._dashDemo       = loadDashDemo;
  window.__teamerToolkit._dashCancel     = () => { state.dash.cancel = true; };
  window.__teamerToolkit._dashWindow     = (n, el) => {
    el.closest(".ttdb-tabs").querySelectorAll(".ttdb-tab").forEach(t=>t.classList.remove("active"));
    el.classList.add("active");
    state.dash.windowM = n;
    dashRender();
  };
  window.__teamerToolkit._dashTypeFilter = (f, el) => {
    el.closest(".ttdb-tabs").querySelectorAll(".ttdb-tab").forEach(t=>t.classList.remove("active"));
    el.classList.add("active");
    state.dash.typeFilter = f;
    const months = dashBuildMonths(state.dash.windowM);
    dashRenderTypes(state.dash.items.filter(i=>months.includes(i.month)));
  };

  window.addEventListener("resize", () => {
    if (state.dash.items.length && document.getElementById("tt-dashboard")) {
      const months = dashBuildMonths(state.dash.windowM);
      dashRenderBar(months, state.dash.items.filter(i=>months.includes(i.month)));
    }
  });

  // ==================================================================
  // ==== TOOLKIT PANEL UI ===========================================
  // ==================================================================

  function createPanel() {
    const panel = document.createElement("div");
    panel.id = "tt-panel";
    panel.style.cssText = [
      "position:fixed","bottom:10px","right:10px","width:380px","max-height:65vh",
      "background:#1f1f1f","color:#fff","padding:10px","border-radius:10px",
      "z-index:999999","font:12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial",
      "box-shadow:0 8px 30px rgba(0,0,0,.35)"
    ].join(";");

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div><b>Teamer Toolkit</b> <span style="opacity:.5;font-size:10px">v3</span></div>
        <div style="display:flex;gap:6px">
          <button id="tt-min"   style="cursor:pointer;border:0;border-radius:6px;padding:4px 8px">_</button>
          <button id="tt-close" style="cursor:pointer;border:0;border-radius:6px;padding:4px 8px">X</button>
        </div>
      </div>
      <div id="tt-stats" style="font-size:10px;opacity:.7;margin-bottom:8px">
        Calls: <b id="tt-cnt">0</b> &nbsp; Endpoints: <b id="tt-eps">0</b> &nbsp; Errores: <b id="tt-errs" style="color:#e83e8c">0</b>
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-bottom:8px">
        <button id="tt-highlight" style="cursor:pointer;border:0;border-radius:8px;padding:6px;font-size:10px">Highlight</button>
        <button id="tt-copy"      style="cursor:pointer;border:0;border-radius:8px;padding:6px;font-size:10px">Copy user</button>
        <button id="tt-export"    style="cursor:pointer;border:0;border-radius:8px;padding:6px;font-size:10px;background:#00C4E9;color:#000;font-weight:700">⬇ Export</button>
        <button id="tt-clear"     style="cursor:pointer;border:0;border-radius:8px;padding:6px;font-size:10px">Clear</button>
        <button id="tt-dashboard-btn" style="cursor:pointer;border:0;border-radius:8px;padding:6px;font-size:10px;background:#7c3aed;color:#fff;font-weight:700">📊 Vol.</button>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <input id="tt-endpoint" placeholder="/ruta/api o URL completa"
               style="flex:1;border-radius:8px;border:1px solid #444;padding:6px;background:#111;color:#fff"/>
        <button id="tt-call" style="cursor:pointer;border:0;border-radius:8px;padding:6px 10px">Call</button>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button id="tt-show-net" style="cursor:pointer;border:0;border-radius:8px;padding:6px;flex:1">Network log</button>
        <button id="tt-debug"    style="cursor:pointer;border:0;border-radius:8px;padding:6px;flex:1">Debug: OFF</button>
      </div>
      <pre id="tt-output" style="white-space:pre-wrap;background:#0f0f0f;border:1px solid #333;border-radius:10px;padding:8px;overflow:auto;max-height:28vh;margin:0;font-size:11px"></pre>
    `;

    document.body.appendChild(panel);
    state.ui.panel         = panel;
    state.ui.output        = panel.querySelector("#tt-output");
    state.ui.endpointInput = panel.querySelector("#tt-endpoint");

    panel.querySelector("#tt-highlight").onclick    = () => applyHighlight();
    panel.querySelector("#tt-copy").onclick         = async () => { const el=getUserElement(); if(!el) return alert("❌ No encontrado"); await copyToClipboard(el.innerText); };
    panel.querySelector("#tt-call").onclick         = () => { const v=state.ui.endpointInput.value.trim(); if(!v) return alert("Pon una ruta o URL"); apiCall(v); };
    panel.querySelector("#tt-show-net").onclick     = () => renderNetwork(true);
    panel.querySelector("#tt-clear").onclick        = () => { state.network=[]; Object.keys(state.byPattern).forEach(k=>delete state.byPattern[k]); updateStats(); setOutput("🧹 Log limpiado"); };
    panel.querySelector("#tt-export").onclick       = () => doExport();
    panel.querySelector("#tt-dashboard-btn").onclick = () => openDashboard();
    panel.querySelector("#tt-debug").onclick        = () => { CONFIG.debug=!CONFIG.debug; panel.querySelector("#tt-debug").textContent=`Debug: ${CONFIG.debug?"ON":"OFF"}`; };
    panel.querySelector("#tt-close").onclick        = () => destroy();

    let minimized = false;
    panel.querySelector("#tt-min").onclick = () => {
      minimized = !minimized;
      ["#tt-output","#tt-endpoint","#tt-call","#tt-show-net","#tt-debug","#tt-export","#tt-clear","#tt-stats","#tt-dashboard-btn"].forEach(sel => {
        const el = panel.querySelector(sel); if(el) el.style.display = minimized ? "none" : "";
      });
    };

    let drag=false, ox=0, oy=0;
    panel.addEventListener("mousedown", e => { if(e.target.tagName==="BUTTON"||e.target.tagName==="INPUT") return; drag=true; ox=e.clientX-panel.offsetLeft; oy=e.clientY-panel.offsetTop; panel.style.cursor="grabbing"; });
    document.addEventListener("mousemove", e => { if(!drag) return; panel.style.left=(e.clientX-ox)+"px"; panel.style.top=(e.clientY-oy)+"px"; panel.style.right="auto"; panel.style.bottom="auto"; });
    document.addEventListener("mouseup", () => { drag=false; panel.style.cursor="default"; });
  }

  function updateStats() {
    const c=document.getElementById("tt-cnt"); if(!c) return;
    const totalErrors=Object.values(state.byPattern).reduce((s,e)=>s+e.errors,0);
    c.textContent=state.network.length;
    document.getElementById("tt-eps").textContent=Object.keys(state.byPattern).length;
    const re=document.getElementById("tt-errs"); re.textContent=totalErrors; re.style.color=totalErrors>0?"#e83e8c":"#00CFB9";
  }

  function renderNetwork(force=false) {
    if (!state.ui.output) return;
    updateStats();
    if (!force && !state.ui.output.textContent.startsWith("NET")) return;
    const lines=[`NET (${state.network.length} capturadas · ${Object.keys(state.byPattern).length} endpoints únicos):`, "ts | type | method | status | ms | url", "-".repeat(80)];
    for (const n of state.network.slice(0,30)) lines.push(`${n.ts} | ${n.type} | ${n.method} | ${n.status} | ${n.ms}ms | ${n.url}${n.error?"\n   error: "+n.error:""}`);
    setOutput(lines.join("\n"));
  }

  // ==== Observer ====
  function installObserver() {
    applyHighlight();
    const obs = new MutationObserver(() => applyHighlight());
    obs.observe(document.body, { childList:true, subtree:true });
    state.observer = obs;
  }

  // ==== Destroy ====
  function destroy() {
    try {
      closeDashboard();
      if (state.observer) state.observer.disconnect();
      uninstallNetworkHooks();
      if (state.ui.panel) state.ui.panel.remove();
      const s = document.getElementById("tt-dashboard-style");
      if (s) s.remove();
      window.__teamerToolkitLoaded = false;
      window.__teamerToolkit = null;
      console.log("🧹 TeamerToolkit desinstalado");
    } catch (e) { console.error(e); }
  }

  // ==== Public API ====
  window.__teamerToolkit.export      = buildAnalysis;
  window.__teamerToolkit.exportRaw   = buildRaw;
  window.__teamerToolkit.download    = doExport;
  window.__teamerToolkit.getAuth     = getAuth;
  window.__teamerToolkit.network     = state.network;
  window.__teamerToolkit.byPattern   = state.byPattern;
  window.__teamerToolkit.openDashboard = openDashboard;

  // ==== Init ====
  installNetworkHooks();
  installObserver();
  createPanel();
  setOutput("✅ Listo (v3).\n- Network logger activo (bodies + headers).\n- Pulsa '📊 Vol.' para abrir el dashboard de volumetría.\n- Pulsa '⬇ Export' para descargar los 2 JSON al terminar.");

})();
