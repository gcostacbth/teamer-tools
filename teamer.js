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

  // All known endpoints captured from session analysis (tt-analysis-2026-05-20T14-48-37.json)
  // Used to pre-populate the API Explorer even before the current session intercepts them.
  const KNOWN_ENDPOINTS = [
    {method:"POST",pattern:"https://apicollector.pro.internal.caixabank.com/tech/rla/logs",count:215,statusCodes:{"200":215},queryParamKeys:[],responseFields:["numIndexedLogs"]},
    {method:"POST",pattern:"https://api.pro.internal.caixabank.com/devops/others/bis/idewan/matomo.php",count:40,statusCodes:{"200":39,"401":1},queryParamKeys:[],responseFields:[]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/bis/1/requests/{id}",count:16,statusCodes:{"200":16},queryParamKeys:[],responseFields:["request-id","date","type-id","requester","requester_name","room-id"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/bis/1/types/{id}",count:16,statusCodes:{"200":16},queryParamKeys:[],responseFields:["type-id","description","category-id","categoryDescription","processKey","approvalDueDate","resolutionDueDate","approvalsRequired","isVisible","isBlocked","room-id"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/processApplication/bis/int/topics/services",count:14,statusCodes:{"200":14},queryParamKeys:["page","isAdmin","size"],responseFields:["totalPages","totalElements","size","number","numberOfElements","last","first","empty","content"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/processApplication/bis/topics",count:14,statusCodes:{"200":14},queryParamKeys:["closureReason","page","size","status"],responseFields:["totalPages","totalElements","size","number","numberOfElements","last","first","empty","content"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/",count:11,statusCodes:{"404":11},queryParamKeys:["userId"],responseFields:[]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/bis/1/requests/{id}/logs",count:11,statusCodes:{"200":11},queryParamKeys:["tag","page","size"],responseFields:["totalPages","totalElements","size","number","numberOfElements","last","first","empty","content"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/tech/bpmcontroller/3/process/{ref}/taskList",count:7,statusCodes:{"200":7},queryParamKeys:["includeBreadcrumb"],responseFields:["breadCrumb","processStatus","processContext"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/bis/1/my-processes/{ref}/candidates",count:7,statusCodes:{"200":7},queryParamKeys:[],responseFields:["candidates"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/bis/1/types",count:5,statusCodes:{"200":5},queryParamKeys:["isAdvanced","page","size"],responseFields:["totalPages","totalElements","size","number","numberOfElements","last","first","empty","content"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/crossChannel/crossChannelManagement/alias/ruleTargets/DashboardTeamer/tags",count:4,statusCodes:{"401":1,"404":3},queryParamKeys:[],responseFields:[]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/bis/1/categories",count:4,statusCodes:{"200":3,"401":1},queryParamKeys:["page","size"],responseFields:["totalPages","totalElements","size","number","numberOfElements","last","first","empty","content"]},
    {method:"POST",pattern:"https://api.pro.internal.caixabank.com/tech/idecua/api/v1/stats/queryElk",count:2,statusCodes:{"200":2},queryParamKeys:[],responseFields:["took","timed_out","_shards","hits","aggregations"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/bis/1/rooms/{id}/attachments",count:2,statusCodes:{"200":2},queryParamKeys:["page","size"],responseFields:["totalPages","totalElements","size","number","numberOfElements","last","first","empty","content"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/tech/idegar/1/applications",count:2,statusCodes:{"200":2},queryParamKeys:["page","size"],responseFields:["totalPages","totalElements","size","number","numberOfElements","last","first","empty","content"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/processApplication/bis/topic/{ref}/feedback",count:2,statusCodes:{"200":2},queryParamKeys:[],responseFields:["completedBy","resolutionRating","iaRating"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/bis/1/my-tasks",count:2,statusCodes:{"200":2},queryParamKeys:["isAdvanced","page","size","description"],responseFields:["totalPages","totalElements","size","number","numberOfElements","last","first","empty","content"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/bis/1/my-processes",count:2,statusCodes:{"200":2},queryParamKeys:["isAdvanced","page","size","description"],responseFields:["totalPages","totalElements","size","number","numberOfElements","last","first","empty","content"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/dashboardTeamer/bis/notifications/own/employees/id",count:2,statusCodes:{"200":1,"401":1},queryParamKeys:[],responseFields:[]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/processApplication/bis/topic/{ref}",count:2,statusCodes:{"200":2},queryParamKeys:[],responseFields:["processInstanceId","idRequest","ppm","title","description","fieldValues","idAppGar","appGar","idResolverITService","resolverITService","idSourceITService","sourceITService"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/processApplication/bis/topic/itService/{id}/origins",count:2,statusCodes:{"200":2},queryParamKeys:[],responseFields:[]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/processApplication/bis/topic/itService/{id}",count:2,statusCodes:{"200":2},queryParamKeys:[],responseFields:["id","name","roomId"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/tech/idegar/1/itServices/{id}",count:2,statusCodes:{"200":2},queryParamKeys:[],responseFields:["id","name","description","groupId","groupName","backlogId","code","responsibles","applications"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/processApplication/bis/int/processInstances/{ref}/topics/resolvers",count:2,statusCodes:{"200":2},queryParamKeys:[],responseFields:[]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/tech/idecua/api/v1/user",count:1,statusCodes:{"200":1},queryParamKeys:[],responseFields:["matricula","mail","nombre","apellidos","token","company","centre","type","empresaActiva","avatarUrl","roles","reglas"]},
    {method:"POST",pattern:"https://api.pro.internal.caixabank.com/tech/bpmcontroller/3/tasks/{ref}/claim",count:1,statusCodes:{"403":1},queryParamKeys:[],responseFields:[]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/processApplication/bis/topic/itService/{id}/template",count:1,statusCodes:{"404":1},queryParamKeys:[],responseFields:[]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/bis/1/rooms/{id}/comments",count:1,statusCodes:{"200":1},queryParamKeys:["page","size"],responseFields:["totalPages","totalElements","size","number","numberOfElements","last","first","empty","content"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/dashboardTeamer/bis/userConfiguration/employees/id",count:1,statusCodes:{"200":1},queryParamKeys:[],responseFields:[]},
    {method:"POST",pattern:"https://api.pro.internal.caixabank.com/token",count:1,statusCodes:{"200":1},queryParamKeys:[],responseFields:["access_token","token_type","expires_in"]},
    {method:"GET",pattern:"https://api.pro.internal.caixabank.com/devops/dashboardTeamer/bis/notifications/count/employees/id",count:1,statusCodes:{"200":1},queryParamKeys:[],responseFields:[]},
  ];

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
    // 1. Prioridad máxima: body del endpoint /token (OIDC rotation)
    //    Angular PKCE intercambia el auth code vía POST /token y devuelve
    //    access_token en el body — es la fuente más fresca disponible.
    for (const c of state.network) {
      if (c.url && /\/token(\?.*)?$/.test(c.url) && c.status === 200 && c.resBody) {
        const body = (c.resBody && typeof c.resBody === "object")
          ? c.resBody : tryParseJson(c.resBody);
        if (body && body.access_token) return "Bearer " + body.access_token;
      }
    }
    // 2. Cabecera Authorization de peticiones recientes (Bearer únicamente)
    for (const c of state.network) {
      const auth = c.reqHeaders?.Authorization || c.reqHeaders?.authorization;
      if (auth && auth.startsWith("Bearer ")) return auth;
    }
    // 3. sessionStorage / localStorage
    for (const store of [sessionStorage, localStorage]) {
      try {
        for (let i = 0; i < store.length; i++) {
          const v = store.getItem(store.key(i));
          if (v && v.startsWith("Bearer ")) return v;
          if (v && v.startsWith("eyJ"))     return "Bearer " + v;
        }
      } catch {}
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
  @keyframes ttdb-open{
    0%   { opacity:0; transform:translateY(-28px) scale(.94); filter:blur(4px); }
    65%  { transform:translateY(4px) scale(1.005); filter:blur(0); }
    100% { opacity:1; transform:translateY(0) scale(1); filter:blur(0); }
  }
  #tt-dashboard{position:fixed;inset:0;z-index:2147483640;background:#f0f2f5;font-family:'Segoe UI',system-ui,sans-serif;color:#000026;overflow-y:auto;display:flex;flex-direction:column;animation:ttdb-open .42s cubic-bezier(.22,.68,0,1.15) both}

  @keyframes ttdb-hdr-shine{
    0%   { transform:translateX(-120%) skewX(-18deg); opacity:1; }
    100% { transform:translateX(700%)  skewX(-18deg); opacity:0; }
  }
  .ttdb-header{background:#fff;border-bottom:2px solid #dde3e8;padding:12px 24px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;flex-shrink:0;position:relative;overflow:hidden}
  .ttdb-header::after{content:'';position:absolute;top:0;left:0;width:28%;height:100%;background:linear-gradient(90deg,transparent,rgba(0,196,233,.18),rgba(124,58,237,.08),transparent);animation:ttdb-hdr-shine .75s .15s ease-out both;pointer-events:none}

  @keyframes ttdb-card-in{
    from{ opacity:0; transform:translateY(14px) scale(.96); }
    to  { opacity:1; transform:translateY(0)    scale(1);   }
  }
  .ttdb-kcard{ animation:ttdb-card-in .32s cubic-bezier(.22,.68,0,1.15) both; }
  .ttdb-kcard:nth-child(1){ animation-delay:.05s; }
  .ttdb-kcard:nth-child(2){ animation-delay:.09s; }
  .ttdb-kcard:nth-child(3){ animation-delay:.13s; }
  .ttdb-kcard:nth-child(4){ animation-delay:.17s; }
  .ttdb-kcard:nth-child(5){ animation-delay:.21s; }
  .ttdb-kcard:nth-child(6){ animation-delay:.25s; }
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

  .ttdb-nav{display:flex;gap:0;background:#fff;border-bottom:2px solid #dde3e8;padding:0 24px;flex-shrink:0}
  .ttdb-ntab{font-size:11px;font-weight:700;padding:10px 18px;cursor:pointer;color:#8a9bb0;border-bottom:3px solid transparent;margin-bottom:-2px;transition:color .15s,border-color .15s;user-select:none;white-space:nowrap}
  .ttdb-ntab:hover{color:#2c3050}
  .ttdb-ntab.active{color:#2c3050;border-bottom-color:#00C4E9}

  .ttdb-svc-filter{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 0 4px}
  .ttdb-svc-select{font-size:11px;padding:6px 12px;border-radius:8px;border:1px solid #dde3e8;background:#fff;color:#2c3050;cursor:pointer;min-width:220px}
  .ttdb-svc-select:focus{outline:2px solid #00C4E9;border-color:#00C4E9}
  .ttdb-cons-main{padding:18px 24px;display:flex;flex-direction:column;gap:14px;flex:1}
  .ttdb-times-main{padding:18px 24px;display:flex;flex-direction:column;gap:14px;flex:1}

  .ttdb-cplx{display:flex;gap:8px;flex-wrap:wrap}
  .ttdb-cplx-item{flex:1;min-width:90px;background:#f5f7f9;border:1px solid #dde3e8;border-radius:8px;padding:10px 12px;text-align:center}
  .ttdb-cplx-val{font-size:22px;font-weight:800;line-height:1}
  .ttdb-cplx-lbl{font-size:9px;text-transform:uppercase;letter-spacing:1.3px;color:#8a9bb0;margin-top:4px}

  .ttdb-itip{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;background:#edf0f3;border:1px solid #c2cdd6;color:#8a9bb0;font-size:8px;font-weight:700;cursor:help;flex-shrink:0;vertical-align:middle;margin-left:5px;line-height:1;user-select:none}
  .ttdb-itip:hover{background:#00C4E9;color:#fff;border-color:#00C4E9}

  .ttdb-net-main{padding:18px 24px;display:flex;flex-direction:column;gap:10px;flex:1;overflow-y:auto}
  .ttdb-net-row{background:#fff;border:1px solid #dde3e8;border-radius:10px;overflow:hidden}
  .ttdb-net-head{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;user-select:none;gap:8px;flex-wrap:wrap}
  .ttdb-net-head:hover{background:#f5f7f9}
  .ttdb-net-method{font-size:9px;font-weight:800;padding:2px 7px;border-radius:4px;flex-shrink:0;letter-spacing:.5px}
  .ttdb-net-m-get{background:#e0f7fa;color:#00838f}
  .ttdb-net-m-post{background:#fff3e0;color:#e65100}
  .ttdb-net-url{font-size:10px;font-family:monospace;color:#2c3050;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
  .ttdb-net-cnt{font-size:10px;font-weight:700;color:#8a9bb0;white-space:nowrap}
  .ttdb-net-ms{font-size:9px;color:#c2cdd6;white-space:nowrap}
  .ttdb-net-err{font-size:9px;color:#e83e8c;white-space:nowrap}
  .ttdb-net-chev{font-size:9px;color:#c2cdd6;flex-shrink:0;transition:transform .2s}
  .ttdb-net-row.open .ttdb-net-chev{transform:rotate(90deg)}
  .ttdb-net-body{display:none;border-top:1px solid #f0f2f5;padding:12px 14px;gap:10px;flex-direction:column}
  .ttdb-net-row.open .ttdb-net-body{display:flex}
  .ttdb-net-sc{display:flex;gap:6px;flex-wrap:wrap}
  .ttdb-sc-pill{font-size:9px;font-weight:700;padding:2px 7px;border-radius:4px}
  .ttdb-sc-2{background:#e8f5e9;color:#2e7d32} .ttdb-sc-4{background:#fff3e0;color:#e65100} .ttdb-sc-5{background:#fce4ec;color:#c62828} .ttdb-sc-e{background:#f5f5f5;color:#616161}
  .ttdb-net-fields{display:flex;gap:5px;flex-wrap:wrap;margin-top:2px}
  .ttdb-fld{font-size:9px;background:#f5f7f9;border:1px solid #dde3e8;border-radius:4px;padding:2px 6px;color:#2c3050;font-family:monospace}
  .ttdb-fld b{color:#7c3aed}
  .ttdb-net-pre{background:#0d1117;color:#e6edf3;font-size:9px;font-family:monospace;line-height:1.5;padding:10px 12px;border-radius:6px;overflow:auto;max-height:240px;white-space:pre;margin:0}
  .ttdb-net-section{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#8a9bb0;margin-bottom:4px}

  .ttdb-thist-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:10px}
  .ttdb-thist-lbl{width:60px;flex-shrink:0;color:#8a9bb0;text-align:right;font-size:9px}
  .ttdb-thist-bar-wrap{flex:1;height:14px;background:#edf0f3;border-radius:3px;overflow:hidden}
  .ttdb-thist-bar-fill{height:100%;border-radius:3px;transition:width .4s}
  .ttdb-thist-val{width:36px;text-align:right;font-weight:700;color:#2c3050;flex-shrink:0;font-size:10px}
  .ttdb-thist-pct{width:28px;text-align:right;font-size:9px;color:#8a9bb0;flex-shrink:0}

  .ttdb-section-title{font-size:11px;font-weight:800;letter-spacing:.5px;color:#2c3050;padding:4px 0 2px;border-bottom:2px solid #dde3e8;margin-bottom:4px}
  .ttdb-imp-row{display:flex;align-items:center;gap:6px;margin-bottom:5px;font-size:10px}
  .ttdb-imp-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#2c3050;min-width:0;font-size:10px}
  .ttdb-imp-stack{flex:0 0 160px;height:12px;border-radius:3px;overflow:hidden;display:flex;background:#edf0f3}
  .ttdb-imp-seg{height:100%;transition:width .45s}
  .ttdb-imp-val{width:36px;text-align:right;font-weight:700;color:#e83e8c;flex-shrink:0;font-size:10px}
  .ttdb-imp-pct{width:28px;text-align:right;font-size:9px;color:#8a9bb0;flex-shrink:0}
  .ttdb-kcard-red::before{background:#e83e8c}
  .ttdb-kcard-red .ttdb-kv{color:#e83e8c}

  #ttdb-ct{display:none;position:fixed;z-index:2147483647;background:#000026;color:#fff;font-size:10px;line-height:1.65;padding:8px 12px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.5);max-width:220px;white-space:normal;pointer-events:none;font-family:'Segoe UI',system-ui,sans-serif;letter-spacing:0}
  #ttdb-ct b{color:#00C4E9}
  #ttdb-ct .ct-warn{color:#f4a53d}
  #ttdb-ct .ct-red{color:#e83e8c}
  #ttdb-ct .ct-grn{color:#00CFB9}
  #ttdb-ct hr{border:none;border-top:1px solid rgba(255,255,255,.12);margin:5px 0}

  .ttdb-backlog-top-row{display:grid;gap:6px;font-size:10px;align-items:center;padding:4px 0;border-bottom:1px solid #f5f7f9}
  .ttdb-backlog-top-row:last-child{border-bottom:none}
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
        <div id="ttdb-hdr-svc" style="display:none;align-items:center;gap:6px;flex-shrink:0">
          <span style="font-size:10px;font-weight:700;color:#8a9bb0;text-transform:uppercase;letter-spacing:1px;white-space:nowrap">Servicio</span>
          <select class="ttdb-svc-select" id="ttdb-svc-select" onchange="window.__teamerToolkit._dashSvcFilter(this.value)">
            <option value="all">Todos los servicios</option>
          </select>
          <span id="ttdb-cons-count" style="font-size:10px;color:#8a9bb0;white-space:nowrap"></span>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="ttdb-btn ttdb-btn-primary" id="ttdb-btn-demo" onclick="window.__teamerToolkit._dashDemo()">Demo</button>
          <button class="ttdb-btn ttdb-btn-close" onclick="window.__teamerToolkit._dashClose()">✕ Cerrar</button>
        </div>
      </div>

      <div class="ttdb-nav">
        <div class="ttdb-ntab active" id="ttdb-nt-vol"  onclick="window.__teamerToolkit._dashNav('vol',this)">📊 Volumetría</div>
        <div class="ttdb-ntab"        id="ttdb-nt-cons" onclick="window.__teamerToolkit._dashNav('cons',this)">💬 Consultas</div>
        <div class="ttdb-ntab"        id="ttdb-nt-times" onclick="window.__teamerToolkit._dashNav('times',this)">⏱ T. Consultas</div>
        <div class="ttdb-ntab"        id="ttdb-nt-net"  onclick="window.__teamerToolkit._dashNav('net',this)">📡 API</div>
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
            <span>Volumen mensual</span><span class="ttdb-itip" data-tip="Agrupación por mes de processInitDate. Azul: Consultas · Morado: Peticiones. El % encima de cada barra es el cambio vs el mes anterior (MoM delta).">i</span>
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

        <div class="ttdb-card">
          <div class="ttdb-card-title"><span>Por categoría</span><span class="ttdb-itip" data-tip="Campo categoryDescription de cada proceso. 6 categorías del portal (101-Consultas, 61-Ticketing, 81-Operación, 3-Aprovisionamiento, 21-Ciclo de vida, 141-Plataforma Cognitiva). Fuente: GET /devops/bis/1/categories.">i</span></div>
          <div id="ttdb-cats"></div>
        </div>

        <div class="ttdb-row2">
          <div class="ttdb-card">
            <div class="ttdb-card-title"><span>Estado</span><span class="ttdb-itip" data-tip="Distribución de processStatus: InProgress (activos), Cancelled (cerrados sin resolver), Expired (SLA vencido). Campo processStatus de GET /devops/bis/1/my-processes.">i</span></div>
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
              <span>Top tipos</span><span class="ttdb-itip" data-tip="Campo requestTypeDescription de cada proceso (sin prefijo [ID]). Top 10 tipos más frecuentes del periodo. Filtrable por Consultas / Peticiones. Fuente: GET /devops/bis/1/my-processes.">i</span>
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

      <div class="ttdb-cons-main" id="ttdb-cons-main" style="display:none">
        <div class="ttdb-kpis" id="ttdb-cons-kpis"></div>

        <div class="ttdb-section-title">📬 Backlog actual · Consultas en curso</div>
        <div class="ttdb-kpis" id="ttdb-backlog-kpis"></div>
        <div class="ttdb-row2">
          <div class="ttdb-card">
            <div class="ttdb-card-title"><span>Distribución de edad</span>${ttip("¿Cuánto tiempo llevan abiertas las consultas IN_PROGRESS? Cada bucket muestra cuántas llevan ese tiempo esperando resolución. Los buckets naranja/rojo indican acumulación de deuda en el backlog.")}</div>
            <div id="ttdb-backlog-age"></div>
          </div>
          <div class="ttdb-card">
            <div class="ttdb-card-title"><span>Backlog por servicio</span>${ttip("Número de consultas actualmente abiertas (IN_PROGRESS) por servicio resolver. El color de barra indica la mediana de edad: verde &lt; 3 días, azul &lt; 7 días, naranja &lt; 30 días, rojo &gt; 30 días. Pasa el ratón por cada fila para ver detalle.")}</div>
            <div id="ttdb-backlog-svc"></div>
          </div>
        </div>
        <div class="ttdb-card">
          <div class="ttdb-card-title"><span>Las que más esperan · Top consultas abiertas</span>${ttip("Las 10 consultas IN_PROGRESS con más antigüedad en el backlog. Ordenadas de más antigua a más reciente. Rojo = más de 30 días · Naranja = más de 7 días · Azul = menos de 7 días.")}</div>
          <div id="ttdb-backlog-top"></div>
        </div>

        <div class="ttdb-card">
          <div class="ttdb-card-title">
            <span>Distribución por servicio</span>${ttip("Campo resolverITService de cada consulta (topic). Muestra volumen total del periodo independientemente del filtro seleccionado. GET /devops/processApplication/bis/topics.")}
          </div>
          <div id="ttdb-cons-services"></div>
        </div>

        <div class="ttdb-card">
          <div class="ttdb-card-title">
            <span>Apertura vs Cierre</span>${ttip("Azul: consultas abiertas ese mes (initDate). Verde: consultas cerradas ese mes (endDate). Si cierre > apertura el backlog se reduce. Fuente: topics list.")}
            <div class="ttdb-tabs">
              <div class="ttdb-tab active" onclick="window.__teamerToolkit._dashConsWindow(12,this)">12m</div>
              <div class="ttdb-tab" onclick="window.__teamerToolkit._dashConsWindow(6,this)">6m</div>
              <div class="ttdb-tab" onclick="window.__teamerToolkit._dashConsWindow(3,this)">3m</div>
            </div>
          </div>
          <div class="ttdb-legend">
            <div class="ttdb-leg"><div class="ttdb-leg-dot" style="background:#00C4E9"></div>Abiertos</div>
            <div class="ttdb-leg"><div class="ttdb-leg-dot" style="background:#00CFB9"></div>Cerrados</div>
          </div>
          <div class="ttdb-chart-scroll"><svg id="ttdb-cons-openclose" style="display:block;width:100%;min-width:480px" height="180"></svg></div>
        </div>

        <div class="ttdb-row2">
          <div class="ttdb-card">
            <div class="ttdb-card-title">
              <span>Tendencia mensual</span>${ttip("Consultas agrupadas por mes de initDate. Aplica el filtro de servicio seleccionado. GET /devops/processApplication/bis/topics.")}
              <div class="ttdb-tabs">
                <div class="ttdb-tab active" onclick="window.__teamerToolkit._dashConsWindow(12,this)">12m</div>
                <div class="ttdb-tab" onclick="window.__teamerToolkit._dashConsWindow(6,this)">6m</div>
                <div class="ttdb-tab" onclick="window.__teamerToolkit._dashConsWindow(3,this)">3m</div>
              </div>
            </div>
            <div class="ttdb-chart-scroll"><svg id="ttdb-cons-bar" style="display:block;width:100%;min-width:280px" height="160"></svg></div>
          </div>
          <div class="ttdb-card">
            <div class="ttdb-card-title">
              <span>Feedback</span>${ttip("Campo closureReason: \"Resolved with feedback\" = cerrado con respuesta del usuario. \"Inactivity without feedback\" = cerrado por inactividad. Pendiente = IN_PROGRESS aún abierto.")}
            </div>
            <div class="ttdb-donut-wrap">
              <svg id="ttdb-cons-donut" width="90" height="90" viewBox="0 0 100 100" style="flex-shrink:0">
                <circle cx="50" cy="50" r="36" fill="none" stroke="#edf0f3" stroke-width="16"/>
                <g id="ttdb-cons-donut-arcs"></g>
                <text x="50" y="46" text-anchor="middle" font-size="14" font-weight="800" fill="#000026" id="ttdb-cons-donut-total">—</text>
                <text x="50" y="58" text-anchor="middle" font-size="7" fill="#8a9bb0">total</text>
              </svg>
              <div class="ttdb-dlegend" id="ttdb-cons-dlegend"></div>
            </div>
          </div>
        </div>

        <div class="ttdb-row2">
          <div class="ttdb-card">
            <div class="ttdb-card-title">
              <span>Tiempo de resolución</span>${ttip("Distribución de (endDate − initDate) en los topics cerrados. Solo items con endDate. Buckets: &lt;2h / 2-24h / 1-3d / 3-7d / 7-30d / &gt;30d. Fuente: topics list.")}
            </div>
            <div id="ttdb-cons-timehist"></div>
          </div>
          <div class="ttdb-card">
            <div class="ttdb-card-title">
              <span>T. medio por servicio</span>${ttip("Promedio de horas de resolución (endDate − initDate) por resolverITService. Solo topics cerrados con endDate. Aplica filtro de servicio.")}
            </div>
            <div id="ttdb-cons-timebysvc"></div>
          </div>
        </div>

        <div class="ttdb-card">
          <div class="ttdb-card-title">
            <span>Feedback mensual</span>${ttip("% de consultas cerradas (COMPLETED+RESOLVED) con closureReason=Resolved with feedback, agrupado por mes de initDate. La línea punteada marca el 50% como objetivo.")}
          </div>
          <div class="ttdb-chart-scroll"><svg id="ttdb-cons-fb-trend" style="display:block;width:100%;min-width:400px" height="130"></svg></div>
        </div>

        <div class="ttdb-row2">
          <div class="ttdb-card">
            <div class="ttdb-card-title">
              <span>Top solicitantes</span>${ttip("Campo sourceITService: equipo que abre la consulta. Muestra los 10 servicios que más consultas generan. Aplica el filtro de servicio resolver.")}
            </div>
            <div id="ttdb-cons-requesters"></div>
          </div>
          <div class="ttdb-card">
            <div class="ttdb-card-title">
              <span>Tipo de cierre</span>${ttip("Campo closureType.name de los topics cerrados: Resuelto / Leer manual / Asignación equivocada / Duplicado / etc. Indicador de calidad del routing.")}
            </div>
            <div id="ttdb-cons-closure"></div>
          </div>
        </div>

        <div class="ttdb-row2">
          <div class="ttdb-card">
            <div class="ttdb-card-title">
              <span>PPM</span>${ttip("Campo ppm de cada consulta: criticidad del proyecto asociado (No crítico / COSMOS / Normativo / TOP50 / Tier 1). Fuente: topics list endpoint.")}
            </div>
            <div id="ttdb-cons-ppm"></div>
          </div>
          <div class="ttdb-card">
            <div class="ttdb-card-title">
              <span>Complejidad</span>${ttip("Campo complexity de los topics cerrados (COMPLETED + RESOLVED). LOW / MEDIUM / HIGH. Solo disponible tras resolución. Aplica el filtro de servicio.")}
            </div>
            <div class="ttdb-cplx" id="ttdb-cons-cplx"></div>
          </div>
        </div>

        <div class="ttdb-section-title">📋 SLA & Tipos de solicitud <span id="ttdb-join-badge" style="font-size:9px;font-weight:400;margin-left:6px;opacity:.6"></span></div>

        <div class="ttdb-kpis" id="ttdb-sla-kpis"></div>

        <div class="ttdb-row2">
          <div class="ttdb-card">
            <div class="ttdb-card-title">
              <span>SLA por servicio</span>${ttip("Para cada servicio resolver: % de consultas cerradas dentro del plazo (processDueDate del proceso BPM). Requiere cruce con datos de procesos. Los servicios con mayor % de incumplimiento necesitan refuerzo o ajuste de SLA.")}
            </div>
            <div id="ttdb-sla-service"></div>
          </div>
          <div class="ttdb-card">
            <div class="ttdb-card-title">
              <span>Tipos de solicitud</span>${ttip("Campo requestTypeDescription del proceso BPM (sin el prefijo [ID]). Muestra qué plantillas de workflow se usan más. Cruzar con improcedentes para ver qué tipos se enrutan peor.")}
            </div>
            <div id="ttdb-req-types"></div>
          </div>
        </div>

        <div class="ttdb-section-title">🔴 Calidad & Routing · Improcedentes</div>

        <div class="ttdb-kpis" id="ttdb-imp-kpis"></div>

        <div class="ttdb-card">
          <div class="ttdb-card-title">
            <span>Solicitantes × Tipo de cierre</span>${ttip("Para cada empresa solicitante (sourceITService): barra apilada mostrando Resueltos (verde) vs Improcedentes (rojo). Los improcedentes son cierres distintos a Resuelto / Otros / Incidencia. Cuanto mayor la franja roja, peor el routing desde ese equipo.")}
          </div>
          <div id="ttdb-imp-stacked"></div>
        </div>

        <div class="ttdb-row2">
          <div class="ttdb-card">
            <div class="ttdb-card-title">
              <span>Improcedentes × PPM</span>${ttip("Distribución de improcedentes por tipo de proyecto (ppm). Proyectos con mayor PPM que generan improcedentes indican un problema de routing prioritario.")}
            </div>
            <div id="ttdb-imp-ppm"></div>
          </div>
          <div class="ttdb-card">
            <div class="ttdb-card-title">
              <span>Improcedentes × Complejidad</span>${ttip("Los improcedentes de complejidad LOW son los más evitables: consultas simples enrutadas al servicio equivocado, duplicadas o que podrían resolverse con documentación.")}
            </div>
            <div id="ttdb-imp-cplx"></div>
          </div>
        </div>
      </div>

      <div class="ttdb-times-main" id="ttdb-times-main" style="display:none">
        <div class="ttdb-kpis" id="ttdb-times-kpis"></div>

        <div class="ttdb-card">
          <div class="ttdb-card-title">
            <span>Evolución mensual de tiempos</span>${ttip("Evolución del tiempo de resolución mes a mes. Verde continuo: mediana p50 — el 50% de consultas se resuelve en ≤ este tiempo. Azul: promedio. Ámbar punteado: P90 — lo que supera este umbral son los casos problemáticos. Si el promedio se aleja mucho del p50, hay casos extremos que están inflando la media.")}
            <div class="ttdb-tabs">
              <div class="ttdb-tab active" onclick="window.__teamerToolkit._dashTimesWindow(12,this)">12m</div>
              <div class="ttdb-tab" onclick="window.__teamerToolkit._dashTimesWindow(6,this)">6m</div>
              <div class="ttdb-tab" onclick="window.__teamerToolkit._dashTimesWindow(3,this)">3m</div>
            </div>
          </div>
          <div class="ttdb-legend">
            <div class="ttdb-leg"><div class="ttdb-leg-dot" style="background:#00CFB9"></div>Mediana p50</div>
            <div class="ttdb-leg"><div class="ttdb-leg-dot" style="background:#00C4E9"></div>Promedio</div>
            <div class="ttdb-leg"><div class="ttdb-leg-dot" style="background:#f4c53d"></div>P90</div>
          </div>
          <div class="ttdb-chart-scroll"><svg id="ttdb-times-trend" style="display:block;width:100%;min-width:480px" height="180"></svg></div>
        </div>

        <div class="ttdb-row2">
          <div class="ttdb-card">
            <div class="ttdb-card-title"><span>Distribución por tiempo</span>${ttip("Histograma del tiempo de resolución (endDate − initDate) de los topics cerrados. 8 buckets de granularidad fina. Permite ver si la mayoría se resuelve rápido o hay una cola larga de casos lentos que desplazan la media hacia arriba.")}</div>
            <div id="ttdb-times-hist"></div>
          </div>
          <div class="ttdb-card">
            <div class="ttdb-card-title"><span>Aging · en curso</span>${ttip("¿Cuánto tiempo llevan abiertas las consultas actualmente IN_PROGRESS? Los buckets naranja/rojo (>7d) son los que más fricción generan y los que hay que escalar.")}</div>
            <div id="ttdb-times-aging"></div>
          </div>
        </div>

        <div class="ttdb-card">
          <div class="ttdb-card-title"><span>Tiempos por servicio</span>${ttip("Para cada servicio resolver: barra sólida = mediana p50 · franja transparente naranja = promedio · fondo claro = P90. Ordenados de más rápido (arriba) a más lento (abajo). Mínimo 2 consultas cerradas para aparecer.")}</div>
          <div id="ttdb-times-service"></div>
        </div>

        <div class="ttdb-row2">
          <div class="ttdb-card">
            <div class="ttdb-card-title"><span>Por complejidad</span>${ttip("Compara p50 / promedio / P90 entre niveles de complejidad (LOW / MEDIUM / HIGH). Valida si la complejidad declarada correlaciona con el esfuerzo real. Si LOW tarda casi igual que HIGH, algo falla en la clasificación o el enrutamiento.")}</div>
            <div id="ttdb-times-cplx"></div>
          </div>
          <div class="ttdb-card">
            <div class="ttdb-card-title"><span>Por día de apertura</span>${ttip("Tiempo medio de resolución según el día de la semana en que se abrió la consulta. Detecta el efecto fin de semana: consultas abiertas viernes o jueves suelen tardar más porque hay menos disponibilidad inmediata. Mínimo 2 datos por día.")}</div>
            <div id="ttdb-times-weekday"></div>
          </div>
        </div>

        <div class="ttdb-card">
          <div class="ttdb-card-title"><span>¿Dónde se encallan? · Consultas &gt;7 días</span>${ttip("Consultas cerradas que tardaron más de 7 días + consultas actualmente abiertas con más de 7 días de antigüedad. Desglose por servicio, complejidad y PPM — identifica los vectores de encallamiento más frecuentes.")}</div>
          <div id="ttdb-times-bottleneck"></div>
        </div>
      </div>

      <div class="ttdb-net-main" id="ttdb-net-main" style="display:none">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-bottom:4px">
          <span style="font-size:10px;font-weight:700;color:#8a9bb0;text-transform:uppercase;letter-spacing:1px">Filtro</span>
          <div class="ttdb-tabs" style="margin-left:0">
            <div class="ttdb-tab active" onclick="window.__teamerToolkit._dashNetFilter('all',this)">Todo</div>
            <div class="ttdb-tab" onclick="window.__teamerToolkit._dashNetFilter('api',this)">api.pro</div>
            <div class="ttdb-tab" onclick="window.__teamerToolkit._dashNetFilter('errors',this)">Errores</div>
          </div>
          <span id="ttdb-net-count" style="font-size:10px;color:#8a9bb0;flex:1"></span>
          <button class="ttdb-btn ttdb-btn-close" style="padding:4px 10px;font-size:10px" onclick="window.__teamerToolkit._dashNetRefresh()">↺ Actualizar</button>
        </div>
        <div id="ttdb-net-list"></div>
      </div>
    `;

    document.body.appendChild(ov);

    // ── Global tooltip box (position:fixed escapes all overflow:hidden parents) ──
    const _tb = document.createElement("div");
    _tb.id = "ttdb-tip-box";
    _tb.style.cssText = "display:none;position:fixed;z-index:2147483647;background:#000026;color:#fff;font-size:10px;font-weight:400;line-height:1.6;padding:8px 12px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.5);max-width:300px;white-space:normal;pointer-events:none;letter-spacing:0;text-transform:none;font-family:'Segoe UI',system-ui,sans-serif";
    document.body.appendChild(_tb);

    function _posTip(anchor) {
      const r = anchor.getBoundingClientRect();
      let left = r.left;
      if (left + 264 > window.innerWidth - 8) left = window.innerWidth - 268;
      if (left < 8) left = 8;
      _tb.style.left = left + "px";
      _tb.style.top  = (r.bottom + 6) + "px";
      requestAnimationFrame(() => {
        if (r.bottom + 6 + _tb.offsetHeight > window.innerHeight - 4)
          _tb.style.top = Math.max(4, r.top - _tb.offsetHeight - 6) + "px";
      });
    }
    ov.addEventListener("mouseover", e => {
      const it = e.target.closest(".ttdb-itip[data-tip]");
      if (!it) return;
      _tb.innerHTML = it.dataset.tip;
      _tb.style.display = "block";
      _posTip(it);
    });
    ov.addEventListener("mouseout", e => {
      if (!e.target.closest(".ttdb-itip[data-tip]")) return;
      if (e.relatedTarget && e.relatedTarget.closest(".ttdb-itip[data-tip]")) return;
      _tb.style.display = "none";
    });

    // ── Chart tooltip (#ttdb-ct): follows mouse, triggered by [data-ct] elements ──
    const _ct = document.createElement("div");
    _ct.id = "ttdb-ct";
    document.body.appendChild(_ct);
    ov.addEventListener("mousemove", e => {
      const target = e.target.closest("[data-ct]");
      if (!target) { _ct.style.display = "none"; return; }
      _ct.innerHTML = target.dataset.ct;
      _ct.style.display = "block";
      const x = e.clientX + 16, y = e.clientY + 16;
      const w = _ct.offsetWidth  || 200;
      const h = _ct.offsetHeight || 80;
      _ct.style.left = Math.max(4, Math.min(x, window.innerWidth  - w - 8)) + "px";
      _ct.style.top  = Math.max(4, Math.min(y, window.innerHeight - h - 8)) + "px";
    });
    ov.addEventListener("mouseleave", () => { _ct.style.display = "none"; });

    state.dash.overlay    = ov;
    state.dash.windowM    = 12;
    state.dash.typeFilter = "all";
    state.dash.items      = [];
    state.dash.cons        = { items:[], serviceFilter:"all", windowM:12, loaded:false, cancel:false };
    state.dash.timesWindowM = 12;

    // Load processes + topics in parallel from the start so both are ready to join.
    // Processes finish first (smaller dataset); topics run in background and join
    // automatically when done (joinAndEnrich fires from both loaders).
    loadDashData();
    loadConsultasData();
  }

  function closeDashboard() {
    state.dash.cancel = true;
    state.dash.cons.cancel = true;
    stopKeepalive();
    const ov = document.getElementById("tt-dashboard");
    if (ov) ov.remove();
    const tb = document.getElementById("ttdb-tip-box");
    if (tb) tb.remove();
    const ct = document.getElementById("ttdb-ct");
    if (ct) ct.remove();
    state.dash.overlay = null;
  }

  // ── Dashboard data loading ──────────────────────────────────────────

  // Keepalive: llama periódicamente a un endpoint ligero para que el servidor
  // renueve el contexto de sesión y el portal refresque el token en background.
  // Usa window.fetch (versión parcheada) para activar cualquier interceptor
  // de refresco que tenga el portal (Angular HttpInterceptor, axios interceptor, etc.)
  const KEEPALIVE_ENDPOINT = "/devops/dashboardTeamer/bis/notifications/count/employees/id";
  let _keepaliveTimer = null;
  let _keepaliveRefs  = 0;  // ref-count so parallel loaders don't step on each other
  function keepaliveAddRef() { if (++_keepaliveRefs === 1) startKeepalive(); }
  function keepaliveRelease() { if (--_keepaliveRefs <= 0) { _keepaliveRefs = 0; stopKeepalive(); } }

  // Loading-bar ref-count: bar only disappears when ALL active loaders finish
  let _loadingRefs = 0;
  function loadingAddRef()  { _loadingRefs++; }
  function loadingRelease() { if (--_loadingRefs <= 0) { _loadingRefs = 0; dashSetLoading(false); } }

  // ── triggerPortalNav ───────────────────────────────────────────────
  // Clicks an Angular router link in the portal page (under our overlay).
  // The user sees nothing (our dashboard covers it at z-index:2147483640).
  // The click fires Angular's router → route guards run → Angular HttpClient
  // makes API calls through its interceptors → the OIDC interceptor detects
  // an expired token and exchanges a new one silently (hidden iframe, prompt=none).
  // We capture the resulting POST /token response in state.network as usual.
  function triggerPortalNav() {
    // Ordered from most specific (Angular routerLink) to generic href fallback.
    // Exclude anything inside our own overlay.
    const selectors = [
      'a[routerlink]:not(#tt-dashboard *)',
      '[routerlink]:not(#tt-dashboard *)',
      'a[ng-reflect-router-link]:not(#tt-dashboard *)',
      'teamer-menu a:not(#tt-dashboard *)',
      'app-menu a:not(#tt-dashboard *)',
      '#TeamerHeader a:not(#tt-dashboard *)',
      'teamer-header a:not(#tt-dashboard *)',
      `a[href*="${location.origin}"]:not(#tt-dashboard *)`,
      `a[href^="/"]:not(#tt-dashboard *)`,
    ];

    for (const sel of selectors) {
      let candidates;
      try { candidates = [...document.querySelectorAll(sel)]; } catch { continue; }
      // Prefer links that stay on the same origin
      const el = candidates.find(a => {
        const href = a.href || "";
        return !href || href.startsWith(location.origin) || href.startsWith("/");
      }) || candidates[0];
      if (el) {
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        log("[nav-refresh] clicked:", sel, el.href || el.textContent.trim().slice(0,30));
        return true;
      }
    }

    // Last resort: tickle Angular's router by dispatching a popstate.
    // This makes Angular re-evaluate the current route's guards.
    try {
      window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
      log("[nav-refresh] dispatched popstate fallback");
    } catch {}
    return false;
  }

  function startKeepalive() {
    stopKeepalive();
    _keepaliveTimer = setInterval(async () => {
      try {
        // Trigger Angular nav so its OIDC interceptor keeps the session alive.
        // This is the primary mechanism — the HTTP ping below is secondary.
        triggerPortalNav();

        // Low-cost API ping (credentials:include sends session cookies).
        // No explicit Authorization header to avoid poisoning state.network
        // with a stale token that would fool waitForFreshToken.
        await window.fetch(`${CONFIG.dashboardApi}${KEEPALIVE_ENDPOINT}`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        log("[keepalive] ping OK");
      } catch (e) { log("[keepalive] ping error:", e.message); }
    }, 55_000);
  }

  function stopKeepalive() {
    if (_keepaliveTimer) { clearInterval(_keepaliveTimer); _keepaliveTimer = null; }
  }

  // ── waitForFreshToken ──────────────────────────────────────────────
  // Waits until a token DIFFERENT from oldAuth appears in state.network.
  // Actively triggers portal navigation on the first call so Angular's OIDC
  // interceptor fires immediately rather than us waiting passively.
  function waitForFreshToken(oldAuth, timeoutMs = 25000) {
    // Kick Angular's OIDC flow right away — don't just sit and poll.
    triggerPortalNav();

    return new Promise(resolve => {
      const start = Date.now();
      // Re-trigger nav every ~5 s in case the first click didn't land on a
      // route that makes authenticated API calls (some routes are public).
      const navIv = setInterval(() => triggerPortalNav(), 5000);
      const iv = setInterval(() => {
        const fresh = getAuth();
        if (fresh && fresh !== oldAuth) {
          clearInterval(iv); clearInterval(navIv);
          resolve(fresh); return;
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(iv); clearInterval(navIv);
          resolve(null);
        }
      }, 200);
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
          dashSetLoading(true, `Token expirado — navegando portal para renovar… (${attempt + 1}/3)`, null);
          const fresh = await waitForFreshToken(auth, 20000);
          if (!fresh) throw new Error("No se pudo renovar el token — recarga la página manualmente");
          auth = fresh;
          continue;
        }
        throw new Error(`${res.status} — token inválido tras 3 intentos`);
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
    keepaliveAddRef();
    loadingAddRef();    // ref-counted — bar stays until ALL loaders finish
    triggerPortalNav(); // ← navegación proactiva al inicio para asegurar token fresco

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
            id:       item.processInstanceId,   // join key with topics
            month:    d.toISOString().slice(0, 7),
            initDate: item.processInitDate,
            dueDate:  item.processDueDate  || null,
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

      keepaliveRelease();
      loadingRelease();   // hides bar only when consultas also finishes
      if (!state.dash.cancel) {
        dashRender();
        // If topics are already loaded, enrich them now
        if (state.dash.cons.loaded) joinAndEnrich();
      }
    } catch (e) {
      keepaliveRelease();
      loadingRelease();
      // Only show global red error if user is on the vol tab; otherwise store it silently
      const activeTab = document.querySelector(".ttdb-ntab.active")?.id;
      if (!activeTab || activeTab === "ttdb-nt-vol") {
        dashShowErr("Error procesos: " + e.message + " — comprueba que el token sigue activo.");
      } else {
        state.dash.volError = e.message;
        log("[vol] error en background:", e.message);
      }
      console.error("[TeamerToolkit/Dashboard/procesos]", e);
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
        const rd = new Date(d.getFullYear(), d.getMonth(), 1 + Math.floor(Math.random()*28));
        const due = new Date(rd); due.setDate(due.getDate() + [1,5,10,28,60][Math.floor(Math.random()*5)]);
        state.dash.items.push({ month, initDate: rd.toISOString(), dueDate: due.toISOString(), category: cat, typeDesc: "[" + (40000+Math.floor(Math.random()*5000)) + "] " + types[Math.floor(Math.random()*types.length)], status: sts[Math.floor(Math.random()*sts.length)] });
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
    dashRenderCategories(inWin);
    dashRenderDonut(inWin);
    dashRenderTypes(inWin);

    const period = document.getElementById("ttdb-period");
    if (period) period.textContent = months[0] + " → " + months[months.length-1];
  }

  function dashRenderCategories(items) {
    const el = document.getElementById("ttdb-cats");
    if (!el) return;
    const counts = {};
    items.forEach(i => { const c = i.category || "(sin categoría)"; counts[c] = (counts[c]||0)+1; });
    const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
    const maxC = sorted[0]?.[1] || 1;
    const total = items.length || 1;
    const catColors = {
      "Consultas":                           "#00C4E9",
      "Ticketing (Nuevo SAI)":               "#7c3aed",
      "Operación":                           "#00CFB9",
      "Aprovisionamiento de Infraestructura":"#f4c53d",
      "Ciclo de vida de aplicación":         "#e83e8c",
      "Plataforma Cognitiva":                "#30BBE2",
    };
    el.innerHTML = sorted.map(([name, count]) => {
      const color = catColors[name] || "#8a9bb0";
      const w = Math.round(count / maxC * 100);
      return `<div class="ttdb-type-row">
        <div class="ttdb-type-name" style="min-width:200px;max-width:200px" title="${name}">${name}</div>
        <div class="ttdb-type-bar-wrap" style="flex:1;width:auto">
          <div class="ttdb-type-bar-fill" style="width:${w}%;background:${color}"></div>
        </div>
        <div class="ttdb-type-count" style="width:50px">${fmtN(count)}</div>
        <div style="width:32px;text-align:right;font-size:9px;color:#8a9bb0;flex-shrink:0">${pctN(count,total)}%</div>
      </div>`;
    }).join("") || `<div style="text-align:center;padding:20px;color:#8a9bb0;font-size:11px">Sin datos</div>`;
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

  function ttip(text) {
    // Encodes content into data-tip; the global tip box (position:fixed) renders it,
    // escaping overflow:hidden on parent cards and forcing correct text colour.
    const enc = text.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
    return `<span class="ttdb-itip" data-tip="${enc}">i</span>`;
  }

  // Encode an HTML string for safe embedding in a data-ct="..." attribute.
  // The string is later used as innerHTML in the chart tooltip, so HTML tags are intentional.
  function ctEnc(html) {
    return html.replace(/&/g,"&amp;").replace(/"/g,"&quot;");
  }
  // Escape plain text for safe use as HTML text content inside a tooltip.
  function esc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function dashRenderKPIs(items) {
    const el = document.getElementById("ttdb-kpis");
    if (!el) return;

    const now    = new Date();
    const todayS = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now - 7 * 86400000);

    const total  = items.length;
    const cons   = items.filter(isConsulta).length;
    const pet    = total - cons;
    const inp    = items.filter(i => i.status === "InProgress").length;
    const exp    = items.filter(i => i.status === "Expired").length;
    const cancelled = items.filter(i => i.status === "Cancelled").length;
    const hoy    = items.filter(i => (i.initDate || "").slice(0, 10) === todayS).length;
    const semana = items.filter(i => i.initDate && new Date(i.initDate) >= weekAgo).length;

    // En riesgo: InProgress con dueDate pasado o dentro de 48h
    const limit48 = new Date(now.getTime() + 48 * 3600000);
    const riesgo  = items.filter(i => i.status === "InProgress" && i.dueDate && new Date(i.dueDate) <= limit48).length;

    // MoM: compara el penúltimo mes completo vs el anterior (evita el mes actual incompleto)
    const allMonths = dashBuildMonths(12);
    const prevFull  = allMonths[allMonths.length - 2];  // mes anterior completo
    const prev2Full = allMonths[allMonths.length - 3];  // dos meses atrás
    const countPrev  = state.dash.items.filter(i => i.month === prevFull).length;
    const countPrev2 = state.dash.items.filter(i => i.month === prev2Full).length;
    const momDelta   = countPrev2 ? Math.round((countPrev - countPrev2) / countPrev2 * 100) : null;
    const momSign    = momDelta === null ? "—" : (momDelta >= 0 ? "▲" : "▼");
    const momColor   = momDelta === null ? "#8a9bb0" : momDelta > 10 ? "#e83e8c" : momDelta > 0 ? "#f4c53d" : "#00CFB9";
    const momText    = momDelta === null ? "—" : `${momSign} ${Math.abs(momDelta)}%`;

    // Tasa de cierre sin resolución: (Cancelled + Expired) / total
    const sinResolver = cancelled + exp;
    const tasaSinRes  = pctN(sinResolver, total);

    el.innerHTML = `
      <div class="ttdb-kcard ttdb-kc-acc">
        <div class="ttdb-kl">Total periodo${ttip("GET /devops/bis/1/my-processes?user=*&amp;size=3000 · Campo: processInitDate filtrado a los últimos 12 meses. Incluye todos los estados y categorías.")}</div>
        <div class="ttdb-kv">${fmtN(total)}</div>
        <div class="ttdb-ksub">${fmtN(hoy)} hoy · ${fmtN(semana)} esta semana</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-pur">
        <div class="ttdb-kl">Peticiones${ttip("Procesos cuyo campo categoryDescription ≠ \"Consultas\". Incluye: Ticketing/Nuevo SAI, Operación, Aprovisionamiento de Infraestructura, Ciclo de vida de aplicación, Plataforma Cognitiva.")}</div>
        <div class="ttdb-kv">${fmtN(pet)}</div>
        <div class="ttdb-ksub">${pctN(pet,total)}% del total</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-grn">
        <div class="ttdb-kl">Consultas${ttip("Procesos con categoryDescription = \"Consultas\" (category-id: 101). Fuente: campo categoryDescription de my-processes. Categorías via GET /devops/bis/1/categories.")}</div>
        <div class="ttdb-kv">${fmtN(cons)}</div>
        <div class="ttdb-ksub">${pctN(cons,total)}% del total</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-amb">
        <div class="ttdb-kl">Tendencia MoM${ttip("(mes_n−1 − mes_n−2) / mes_n−2 × 100. Compara los dos últimos meses completos, evitando el mes actual (incompleto). Campo: processInitDate agrupado por mes.")}</div>
        <div class="ttdb-kv" style="font-size:22px;color:${momColor}">${momText}</div>
        <div class="ttdb-ksub">${fmtN(countPrev)} vs ${fmtN(countPrev2)} (mes ant.)</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-acc" style="--c:#7c3aed">
        <div class="ttdb-kl">En progreso${ttip("Procesos con processStatus = \"InProgress\". Procesos activos (abiertos) dentro del periodo. Campo processStatus de GET /devops/bis/1/my-processes.")}</div>
        <div class="ttdb-kv" style="color:#7c3aed">${fmtN(inp)}</div>
        <div class="ttdb-ksub">activos ahora</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-rose">
        <div class="ttdb-kl">⚠ En riesgo${ttip("InProgress con processDueDate ≤ ahora + 48h. Procesos activos que vencen en menos de 48 horas o ya han vencido. Campo: processDueDate de my-processes.")}</div>
        <div class="ttdb-kv">${fmtN(riesgo)}</div>
        <div class="ttdb-ksub">InProgress · vence en &lt;48h</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-rose" style="opacity:.85">
        <div class="ttdb-kl">Sin resolver${ttip("(Cancelados + Vencidos) / Total × 100. Cancelled: cerrado sin resolución. Expired: venció el SLA sin resolverse. Campos processStatus de my-processes.")}</div>
        <div class="ttdb-kv" style="font-size:22px">${tasaSinRes}%</div>
        <div class="ttdb-ksub">${fmtN(sinResolver)} Cancelados + Vencidos</div>
      </div>
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
      // valor + delta MoM encima de la barra
      if (tot > 0) {
        const topY = padT + chartH - fullH - 3;
        out += `<text x="${x+barW/2}" y="${topY}" text-anchor="middle" font-size="7" fill="#8a9bb0">${tot}</text>`;
        if (i > 0) {
          const prevTot = byM[months[i-1]].c + byM[months[i-1]].p;
          if (prevTot > 0) {
            const d = Math.round((tot - prevTot) / prevTot * 100);
            const col = d > 10 ? "#e83e8c" : d < -10 ? "#00CFB9" : "#c2cdd6";
            const sym = d >= 0 ? "▲" : "▼";
            out += `<text x="${x+barW/2}" y="${topY - 8}" text-anchor="middle" font-size="6" fill="${col}">${sym}${Math.abs(d)}%</text>`;
          }
        }
      }
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

  // ── Consultas (Topics) data loading ───────────────────────────────
  async function loadConsultasData() {
    const cons = state.dash.cons;
    cons.cancel = false;
    cons.items  = [];
    dashSetLoading(true, "Cargando consultas…", 0);
    keepaliveAddRef();
    loadingAddRef();    // ref-counted loading bar
    triggerPortalNav(); // ← navegación proactiva al inicio
    let page = 0, done = false, totalPages = null;
    try {
      while (!done && !cons.cancel) {
        const data = await dashApiFetch("/devops/processApplication/bis/topics", {
          page, size: 3000, status: "COMPLETED,RESOLVED,IN_PROGRESS"
        });
        if (totalPages === null) totalPages = data.totalPages;
        for (const item of (data.content || [])) {
          const d = item.initDate ? new Date(item.initDate) : null;
          if (!d || isNaN(d.getTime())) continue;   // skip items with no/bad date
          cons.items.push({
            id:             item.processInstanceId,
            reqId:          item.idRequest || null,
            title:          item.title || null,
            month:          d.toISOString().slice(0, 7),
            initDate:       item.initDate,
            endDate:        item.endDate || null,
            resolverService:item.resolverITService || "(sin servicio)",
            sourceService:  item.sourceITService  || "",
            status:         item.status || "",
            closureReason:  item.closureReason || null,
            complexity:     item.complexity || null,
            taskDueDate:    item.taskDueDate || null,
            ppm:            item.ppm || null,
            closureType:    item.closureType?.name || null,
            topicOrigin:    item.topicOrigin?.name || null,
          });
        }
        page++;
        if (data.last) done = true;
        const pct = totalPages ? Math.min(95, Math.round(page / Math.min(totalPages, page+10) * 100)) : 50;
        dashSetLoading(true, `Consultas: pág. ${page}${totalPages?" / ~"+totalPages:""} · ${cons.items.length} topics`, pct);
        await new Promise(r => setTimeout(r, 0));
      }
      keepaliveRelease();
      cons.loaded = true;
      // If processes are already loaded, enrich topics with SLA/type data
      if (state.dash.items.length) joinAndEnrich();
      loadingRelease();   // hides bar only when processes also finished
      if (!cons.cancel) {
        // Only render if the user is actually on the consultas/times tab.
        // On vol/api tabs: data is cached — it will render when the user navigates there.
        const activeTab = document.querySelector(".ttdb-ntab.active")?.id;
        if (activeTab === "ttdb-nt-times") {
          renderTiempos();
        } else if (activeTab === "ttdb-nt-cons") {
          renderConsultas();
        }
        // vol / api / undefined → do nothing, don't touch the visible tab
      }
    } catch (e) {
      keepaliveRelease();
      loadingRelease();
      // Only show global red error if user is watching the consultas/times tab
      const activeTab = document.querySelector(".ttdb-ntab.active")?.id;
      if (activeTab === "ttdb-nt-cons" || activeTab === "ttdb-nt-times") {
        dashShowErr("Error consultas: " + e.message);
      } else {
        // Store it — will surface when user navigates to Consultas or T. Consultas
        state.dash.cons.error = e.message;
        log("[consultas] error en background:", e.message);
      }
    }
  }

  function loadConsultasDemo() {
    const cons = state.dash.cons;
    cons.cancel  = true;
    cons.items   = [];
    cons.loaded       = true;
    cons.serviceFilter = "all";
    const services  = ["Chapter QA","OpenServices","Control de Accesos","Arquitectura API Management","Arquitectura SPA","Arquitectura Canal ABSIS","SQUAD 3","SQUAD 4","SQUAD 5","Ciclo de Vida","Datapool","Transmisión de Ficheros","Autenticación","Arquitectura Batch","Cloud Products Squad"];
    const sources   = ["Isla Indra","ABS - Other Departamental","ABS - ABSIS","Arquitectura Soluciones","OpenFront","Rally Software","Plataforma IA","Framework OpenMobile","Digitalización","GID nominales"];
    const reasons   = ["Resolved with feedback","Resolved with feedback","Resolved with feedback","Inactivity without feedback",null];
    const cplx      = ["LOW","LOW","MEDIUM","MEDIUM","HIGH",null];
    const statuses  = ["IN_PROGRESS","IN_PROGRESS","COMPLETED","COMPLETED","RESOLVED"];
    const ppms      = ["No crítico","No crítico","COSMOS","Normativo","TOP50","Tier 1"];
    const closTypes = ["Resuelto","Resuelto","Resuelto","Leer manual","Asignación equivocada","Duplicado"];
    const origins   = ["No aplica","OCP","JENKINS:consultas","Foro sobre ALM",null];
    const now = new Date();
    for (let m = 0; m < 12; m++) {
      const d    = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const month = d.toISOString().slice(0, 7);
      const vol   = 15 + Math.round(Math.random() * 25) + (m < 3 ? 10 : 0);
      const demoTitles = ["Consulta sobre pipeline de CI/CD","Revisión de arquitectura microservicios","Error en integración OAuth","Timeout en llamadas a API Gateway","Duda sobre certificados SSL","Petición de acceso a repositorio","Problema con despliegue en OCP","Cómo configurar health checks","Revisión de diseño de base de datos","Migración a nuevo cluster Kubernetes","Configuración de alertas Prometheus","Duda sobre límites de rate limiting","Problema con logs en Elastic","Consulta sobre política de branching","Revisión de contrato OpenAPI"];
      for (let i = 0; i < vol; i++) {
        const rd  = new Date(d.getFullYear(), d.getMonth(), 1 + Math.floor(Math.random()*28));
        const st  = statuses[Math.floor(Math.random()*statuses.length)];
        const cr  = st !== "IN_PROGRESS" ? reasons[Math.floor(Math.random()*reasons.length)] : null;
        const end = st !== "IN_PROGRESS" ? new Date(rd.getTime() + (1+Math.random()*6)*86400000) : null;
        const due = new Date(rd.getTime() + (2+Math.floor(Math.random()*12))*86400000);
        const svc = services[Math.floor(Math.random()*services.length)];
        cons.items.push({
          id: "DEMO-"+Math.random().toString(36).slice(2),
          reqId: "BIS-" + (1000 + Math.floor(Math.random()*9000)),
          title: demoTitles[Math.floor(Math.random()*demoTitles.length)] + " · " + svc.split(" ")[0],
          month,
          initDate: rd.toISOString(), endDate: end ? end.toISOString() : null,
          resolverService: svc,
          sourceService:   sources[Math.floor(Math.random()*sources.length)],
          status: st, closureReason: cr,
          complexity:  cr ? cplx[Math.floor(Math.random()*cplx.length)] : null,
          taskDueDate: due.toISOString(),
          ppm:         ppms[Math.floor(Math.random()*ppms.length)],
          closureType: cr ? closTypes[Math.floor(Math.random()*closTypes.length)] : null,
          topicOrigin: cr ? origins[Math.floor(Math.random()*origins.length)] : null,
          // Join fields (from processes) — simulated for demo
          processDueDate: due.toISOString(),
          processStatus: st === "IN_PROGRESS" ? (Math.random()<.15?"Expired":"InProgress") : "Completed",
          requestType: ["Consulta técnica de arquitectura","Búsqueda de consultas","Petición de acceso","Revisión de diseño","Consulta sobre normativa","Incidencia en plataforma","Alta de servicio","Baja de aplicación"][Math.floor(Math.random()*8)],
        });
      }
    }
    // Solo renderizar si la pestaña Consultas está activa
    const consmain = document.getElementById("ttdb-cons-main");
    if (consmain && consmain.style.display !== "none") renderConsultas();
    // Resetear el select de servicio para que se repopule
    const sel = document.getElementById("ttdb-svc-select");
    if (sel) while (sel.options.length > 1) sel.remove(1);
  }

  // ── Join processes ↔ topics on processInstanceId ──────────────────
  // Enriches each topic (cons.items) with:
  //   processDueDate  — SLA deadline from the BPM process
  //   processStatus   — BPM status (Expired/Cancelled) independent of topic status
  //   requestType     — cleaned requestTypeDescription (strip leading "[ID] ")
  // Runs automatically when both loaders complete, in either order.
  function joinAndEnrich() {
    const procMap = {};
    for (const p of state.dash.items) {
      if (p.id) procMap[p.id] = p;
    }
    let enriched = 0;
    for (const t of state.dash.cons.items) {
      const p = procMap[t.id];
      if (p) {
        t.processDueDate   = p.dueDate   || null;
        t.processStatus    = p.status    || null;
        t.requestType      = (p.typeDesc || "").replace(/^\[\d+\]\s*/, "").trim();
        enriched++;
      }
    }
    log(`[join] ${enriched}/${state.dash.cons.items.length} topics enriched with process SLA data`);
    // Re-render whichever tab is currently visible
    const cm = document.getElementById("ttdb-cons-main");
    if (cm && cm.style.display !== "none") renderConsultas();
    const tm = document.getElementById("ttdb-times-main");
    if (tm && tm.style.display !== "none") renderTiempos();
  }

  function renderConsultas() {
    const cons = state.dash.cons;
    const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear()-1);
    const inPeriod  = cons.items.filter(i => new Date(i.initDate) >= cutoff);
    const filtered  = cons.serviceFilter === "all"
      ? inPeriod
      : inPeriod.filter(i => i.resolverService === cons.serviceFilter);

    // Populate service dropdown
    const sel = document.getElementById("ttdb-svc-select");
    if (sel && sel.options.length === 1) {
      const svcs = [...new Set(inPeriod.map(i => i.resolverService))].sort();
      svcs.forEach(s => { const o = document.createElement("option"); o.value = s; o.textContent = s; sel.appendChild(o); });
    }
    if (sel) sel.value = cons.serviceFilter;

    const cntEl = document.getElementById("ttdb-cons-count");
    if (cntEl) cntEl.textContent = `${filtered.length} consulta${filtered.length!==1?"s":""}${cons.serviceFilter!=="all" ? " · "+cons.serviceFilter : ""}`;

    const months = dashBuildMonths(cons.windowM);
    dashRenderConsultasKPIs(filtered);
    dashRenderOpenClose(filtered, months);
    dashRenderServiceBars(inPeriod);
    dashRenderConsultasBar(filtered, months);
    dashRenderFeedbackDonut(filtered);
    dashRenderTimeHist(filtered);
    dashRenderTimeByService(filtered);
    dashRenderFeedbackTrend(filtered, months);
    dashRenderRequesters(filtered);
    dashRenderClosureTypes(filtered);
    dashRenderPPM(filtered);
    dashRenderComplexity(filtered);

    // SLA & tipos (cross with processes)
    dashRenderSLAKPIs(filtered);
    dashRenderSLAByService(filtered);
    dashRenderRequestTypes(filtered);

    // Calidad & Routing — improcedentes analysis
    const closed = filtered.filter(i => i.closureType);
    const imps   = closed.filter(isImprocedente);
    dashRenderImpKPIs(closed);
    dashRenderImpStacked(closed);
    dashRenderImpPPM(imps);
    dashRenderImpCplx(imps);

    // Backlog actual (IN_PROGRESS only)
    const openItems = filtered.filter(i => i.status === "IN_PROGRESS");
    dashRenderBacklogKPIs(openItems, filtered);
    dashRenderBacklogAge(openItems);
    dashRenderBacklogBySvc(openItems);
    dashRenderBacklogTop(openItems);

    const main = document.getElementById("ttdb-cons-main");
    if (main) main.style.display = "flex";
  }

  // ── Backlog section ─────────────────────────────────────────────────
  function dashRenderBacklogKPIs(openItems, allItems) {
    const el = document.getElementById("ttdb-backlog-kpis");
    if (!el) return;
    const now = Date.now();
    const ages = openItems.map(i => (now - new Date(i.initDate).getTime()) / 3600000).filter(h => isFinite(h) && h >= 0);
    const total  = openItems.length;
    const oldest = ages.length ? Math.max(...ages) : 0;
    const median = ages.length ? percentile(ages, 50) : null;
    const gt7d   = ages.filter(h => h > 168).length;
    const gt30d  = ages.filter(h => h > 720).length;

    // ── Estimación de cierre con media ponderada exponencial ──
    // Usamos las consultas cerradas del historial (con endDate) para calcular
    // la tasa de cierre semanal dando más peso a las semanas recientes.
    const HIST_WEEKS = 12;
    const MS_WEEK    = 7 * 24 * 3600 * 1000;
    const closedHist = (allItems || []).filter(i => i.endDate && i.status !== "IN_PROGRESS");
    // weekCounts[w] = cierres hace w semanas (0 = semana actual, 1 = semana pasada, ...)
    const weekCounts = Array(HIST_WEEKS).fill(0);
    closedHist.forEach(i => {
      const w = Math.floor((now - new Date(i.endDate).getTime()) / MS_WEEK);
      if (w >= 0 && w < HIST_WEEKS) weekCounts[w]++;
    });
    // Peso exponencial: w=0 (más reciente) → peso 1.0, cada semana atrás → ×0.5 (vida media = 2 sem)
    let wSum = 0, wTotal = 0;
    weekCounts.forEach((cnt, w) => {
      const weight = Math.pow(2, -w / 2); // semivida de 2 semanas
      wSum   += weight * cnt;
      wTotal += weight;
    });
    const weightedRate = wTotal > 0 ? wSum / wTotal : 0; // tickets cerrados/semana (ponderado)
    const etaWeeks     = weightedRate > 0.01 ? total / weightedRate : null;
    const etaDate      = etaWeeks !== null
      ? new Date(now + etaWeeks * MS_WEEK).toLocaleDateString("es-ES", { day:"numeric", month:"short", year:"numeric" })
      : null;
    const etaLabel     = etaWeeks !== null
      ? (etaWeeks < 1 ? "< 1 semana" : etaWeeks < 2 ? "~1 semana" : `~${Math.round(etaWeeks)} semanas`)
      : "—";
    const rateLabel    = weightedRate > 0 ? `${weightedRate.toFixed(1)} cierres/sem` : "sin datos";
    const etaColor     = etaWeeks === null ? "" : etaWeeks > 8 ? "ttdb-kcard-red" : etaWeeks > 4 ? "ttdb-kc-amb" : "ttdb-kc-grn";

    // Build tooltip: formula explanation + per-week breakdown (HTML, rendered via innerHTML)
    const weekRowsHtml = weekCounts.slice(0, 8).map((cnt, w) => {
      const weight = Math.pow(2, -w / 2);
      const label  = w === 0 ? "Esta sem" : `Sem -${w}`;
      return `<span style="color:#8a9bb0">${label}</span> ${cnt} cierres · peso <b>${weight.toFixed(2)}</b>`;
    }).join("<br>");
    const etaTip = ttip(
      `<b>Estimación de cierre del backlog</b><br>` +
      `<span style="color:#8a9bb0">Fórmula:</span> Backlog ÷ tasa ponderada<br><br>` +
      `<b>Tasa ponderada</b> = Σ(peso_w × cierres_w) / Σ(peso_w)<br>` +
      `peso_w = 2^(−w/2) · semivida 2 semanas<br>` +
      `→ semana actual vale 2× más que la de hace 2 sem,<br>4× más que hace 4 sem, etc.<br><br>` +
      `<b>Últimas ${HIST_WEEKS} semanas (endDate):</b><br>` +
      weekRowsHtml +
      `<br><br>` +
      `Tasa actual: <b>${rateLabel}</b><br>` +
      `ETA: ${total} ÷ ${weightedRate.toFixed(2)} = <b>${etaWeeks !== null ? etaWeeks.toFixed(1) : "∞"} semanas</b>`
    );

    if (!total) {
      el.innerHTML = `<div style="color:#00CFB9;font-size:12px;padding:8px 0">✓ No hay consultas abiertas en el periodo seleccionado</div>`;
      return;
    }
    el.innerHTML = `
      <div class="ttdb-kcard ttdb-kc-pur">
        <div class="ttdb-kl">Abiertas ahora${ttip("Consultas con status IN_PROGRESS en el periodo de 12 meses. Aplicado el filtro de servicio.")}</div>
        <div class="ttdb-kv">${fmtN(total)}</div>
        <div class="ttdb-ksub">en el backlog actual</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-amb">
        <div class="ttdb-kl">Mediana de edad${ttip("El 50% del backlog lleva menos tiempo que este valor. Un aumento progresivo indica que las consultas entran más rápido de lo que se cierran.")}</div>
        <div class="ttdb-kv">${median !== null ? fmtHours(median) : "—"}</div>
        <div class="ttdb-ksub">el 50% lleva menos tiempo</div>
      </div>
      <div class="ttdb-kcard ${gt7d > Math.ceil(total*0.15) ? "ttdb-kcard-red" : "ttdb-kc-grn"}">
        <div class="ttdb-kl">Más de 7 días${ttip("Consultas que llevan más de 7 días abiertas. Más del 15% del backlog en este estado es señal de alerta.")}</div>
        <div class="ttdb-kv">${fmtN(gt7d)}</div>
        <div class="ttdb-ksub">${pctN(gt7d, total)}% del backlog</div>
      </div>
      <div class="ttdb-kcard ${gt30d > 0 ? "ttdb-kcard-red" : "ttdb-kc-grn"}">
        <div class="ttdb-kl">Más de 30 días${ttip("Consultas con más de 30 días de antigüedad sin cerrarse. Cualquier valor > 0 requiere atención inmediata.")}</div>
        <div class="ttdb-kv">${fmtN(gt30d)}</div>
        <div class="ttdb-ksub">más antigua: ${fmtHours(oldest)}</div>
      </div>
      <div class="ttdb-kcard ${etaColor}">
        <div class="ttdb-kl">Estimación de cierre${etaTip}</div>
        <div class="ttdb-kv" style="font-size:${etaDate ? "12px" : "22px"}">${etaDate || etaLabel}</div>
        <div class="ttdb-ksub">${etaDate ? etaLabel + " · " + rateLabel : rateLabel}</div>
      </div>
    `;
  }

  function dashRenderBacklogAge(openItems) {
    const el = document.getElementById("ttdb-backlog-age");
    if (!el) return;
    if (!openItems.length) {
      el.innerHTML = `<div style="color:#8a9bb0;font-size:11px;padding:8px 0">Sin consultas abiertas</div>`;
      return;
    }
    const now = Date.now();
    const buckets = [
      { lbl:"< 1d",    min:0,    max:24,       color:"#00CFB9", desc:"Recién abiertas" },
      { lbl:"1–3d",    min:24,   max:72,        color:"#00C4E9", desc:"Primer seguimiento" },
      { lbl:"3–7d",    min:72,   max:168,       color:"#7c3aed", desc:"Requieren atención" },
      { lbl:"7–14d",   min:168,  max:336,       color:"#f4c53d", desc:"Alerta: más de 1 semana" },
      { lbl:"14–30d",  min:336,  max:720,       color:"#f4a53d", desc:"Crítico: 2+ semanas" },
      { lbl:"> 30d",   min:720,  max:Infinity,  color:"#e83e8c", desc:"Urgente: más de 1 mes" },
    ];
    const counts = buckets.map(b => openItems.filter(i => {
      const h = (now - new Date(i.initDate).getTime()) / 3600000;
      return isFinite(h) && h >= b.min && h < b.max;
    }).length);
    const total = openItems.length, maxC = Math.max(...counts, 1);
    el.innerHTML = buckets.map((b, i) => {
      const ct = ctEnc(`<b>${esc(b.lbl)}</b> · ${esc(b.desc)}<hr>${counts[i]} consultas<br><span class="ct-grn">${pctN(counts[i],total)}%</span> del backlog`);
      return `<div class="ttdb-thist-row" data-ct="${ct}">
        <div class="ttdb-thist-lbl">${b.lbl}</div>
        <div class="ttdb-thist-bar-wrap"><div class="ttdb-thist-bar-fill" style="width:${Math.round(counts[i]/maxC*100)}%;background:${b.color}"></div></div>
        <div class="ttdb-thist-val">${counts[i]}</div>
        <div class="ttdb-thist-pct">${pctN(counts[i],total)}%</div>
      </div>`;
    }).join("");
  }

  function dashRenderBacklogBySvc(openItems) {
    const el = document.getElementById("ttdb-backlog-svc");
    if (!el) return;
    if (!openItems.length) {
      el.innerHTML = `<div style="color:#8a9bb0;font-size:11px;padding:8px 0">Sin consultas abiertas</div>`;
      return;
    }
    const now = Date.now();
    const bySvc = {};
    openItems.forEach(i => {
      const s = i.resolverService || "Sin servicio";
      if (!bySvc[s]) bySvc[s] = { count:0, ages:[] };
      bySvc[s].count++;
      const h = (now - new Date(i.initDate).getTime()) / 3600000;
      if (isFinite(h) && h >= 0) bySvc[s].ages.push(h);
    });
    const rows = Object.entries(bySvc)
      .map(([s, d]) => ({
        s, count: d.count,
        medAge: d.ages.length ? percentile(d.ages, 50) : 0,
        maxAge: d.ages.length ? Math.max(...d.ages) : 0,
        gt7d:   d.ages.filter(h=>h>168).length,
      }))
      .sort((a,b) => b.count - a.count);
    const maxCount = rows[0].count;
    el.innerHTML = rows.map(r => {
      const w = Math.round(r.count / maxCount * 100);
      const color = r.medAge > 720 ? "#e83e8c" : r.medAge > 168 ? "#f4a53d" : r.medAge > 72 ? "#00C4E9" : "#00CFB9";
      const gt7pct = pctN(r.gt7d, r.count);
      const ct = ctEnc(`<b>${esc(r.s)}</b><hr>${r.count} consultas abiertas<br>Mediana de edad: <b>${esc(fmtHours(r.medAge))}</b><br>Más antigua: <b>${esc(fmtHours(r.maxAge))}</b><br><span class="${r.gt7d>0?"ct-warn":"ct-grn"}">+7d: ${r.gt7d} (${gt7pct}%)</span>`);
      return `<div class="ttdb-type-row" data-ct="${ct}">
        <div class="ttdb-type-name" title="${esc(r.s)}" style="min-width:150px;max-width:150px">${esc(r.s)}</div>
        <div class="ttdb-type-bar-wrap" style="flex:1"><div class="ttdb-type-bar-fill" style="width:${w}%;background:${color}"></div></div>
        <div class="ttdb-type-count">${r.count}</div>
        <div style="width:42px;text-align:right;font-size:9px;color:${color};font-weight:700">${fmtHours(r.medAge)}</div>
      </div>`;
    }).join("");
  }

  function dashRenderBacklogTop(openItems) {
    const el = document.getElementById("ttdb-backlog-top");
    if (!el) return;
    if (!openItems.length) {
      el.innerHTML = `<div style="color:#00CFB9;font-size:11px;padding:10px 0">✓ Sin consultas abiertas en el periodo seleccionado</div>`;
      return;
    }
    const now = Date.now();
    const withAge = openItems.map(i => ({ ...i, ageH: (now - new Date(i.initDate).getTime()) / 3600000 }))
      .filter(i => isFinite(i.ageH));
    const top = withAge.sort((a,b) => b.ageH - a.ageH).slice(0, 10);
    const colorFor = h => h > 720 ? "#e83e8c" : h > 168 ? "#f4a53d" : "#00C4E9";
    const cols = "minmax(0,1fr) 160px 76px 62px 52px";
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:${cols};gap:6px;font-size:9px;font-weight:700;color:#8a9bb0;text-transform:uppercase;letter-spacing:.8px;padding:0 2px 6px;border-bottom:1px solid #edf0f3;margin-bottom:2px">
        <div>Consulta / ID</div><div>Servicio</div><div>PPM</div><div>Complejidad</div><div style="text-align:right">Edad</div>
      </div>
      ${top.map(i => {
        const color = colorFor(i.ageH);
        const label = i.title ? esc(i.title) : (i.reqId ? esc(i.reqId) : esc(i.id));
        const svc   = esc(i.resolverService || "—");
        return `<div class="ttdb-backlog-top-row" style="grid-template-columns:${cols}">
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#2c3050" title="${label}">${label}</div>
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8a9bb0;font-size:9px" title="${svc}">${svc}</div>
          <div style="color:#8a9bb0;font-size:9px">${esc(i.ppm || "—")}</div>
          <div style="color:#8a9bb0;font-size:9px">${esc(i.complexity || "—")}</div>
          <div style="text-align:right;font-weight:700;color:${color}">${fmtHours(i.ageH)}</div>
        </div>`;
      }).join("")}
      ${withAge.length > 10 ? `<div style="font-size:9px;color:#8a9bb0;margin-top:6px;padding-top:4px;border-top:1px solid #f0f2f5">${withAge.length - 10} consultas más en el backlog</div>` : ""}
    `;
  }

  function fmtDays(ms) {
    if (!ms || ms < 0) return "—";
    const h = ms / 3600000;
    if (h < 24) return "<1d";
    return Math.round(h/24) + "d";
  }

  function dashRenderConsultasKPIs(items) {
    const el = document.getElementById("ttdb-cons-kpis");
    if (!el) return;
    const now = new Date();
    const total   = items.length;
    const inprog  = items.filter(i => i.status === "IN_PROGRESS").length;
    const closed  = items.filter(i => i.status !== "IN_PROGRESS");
    const withFB  = closed.filter(i => i.closureReason === "Resolved with feedback").length;
    const noFB    = closed.filter(i => i.closureReason === "Inactivity without feedback").length;
    const fbRate  = closed.length ? Math.round(withFB / closed.length * 100) : null;
    const resTimes= items.filter(i => i.endDate && i.initDate).map(i => new Date(i.endDate)-new Date(i.initDate)).filter(ms => isFinite(ms) && ms >= 0);
    const avgMs   = resTimes.length ? resTimes.reduce((a,b)=>a+b,0)/resTimes.length : null;
    const limit48 = new Date(now.getTime() + 48*3600000);
    const riesgo  = items.filter(i => i.status === "IN_PROGRESS" && i.taskDueDate && new Date(i.taskDueDate) <= limit48).length;
    el.innerHTML = `
      <div class="ttdb-kcard ttdb-kc-acc">
        <div class="ttdb-kl">Total consultas${ttip("Total de consultas (topics) en el periodo de 12 meses. GET /devops/processApplication/bis/topics?status=COMPLETED,RESOLVED,IN_PROGRESS · Campo: initDate.")}</div>
        <div class="ttdb-kv">${fmtN(total)}</div>
        <div class="ttdb-ksub">${fmtN(closed.length)} cerradas · ${fmtN(inprog)} activas</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-pur">
        <div class="ttdb-kl">En curso${ttip("Consultas con status = IN_PROGRESS. Aún abiertas, esperando respuesta o resolución. Campo status de /devops/processApplication/bis/topics.")}</div>
        <div class="ttdb-kv">${fmtN(inprog)}</div>
        <div class="ttdb-ksub">${pctN(inprog,total)}% del total</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-grn">
        <div class="ttdb-kl">Con feedback${ttip("closureReason = \"Resolved with feedback\". El usuario confirmó resolución satisfactoria. Tasa sobre consultas cerradas (COMPLETED + RESOLVED).")}</div>
        <div class="ttdb-kv">${fbRate !== null ? fbRate+"%" : "—"}</div>
        <div class="ttdb-ksub">${fmtN(withFB)} de ${fmtN(closed.length)} cerradas</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-amb">
        <div class="ttdb-kl">Sin feedback${ttip("closureReason = \"Inactivity without feedback\". Cerrado automáticamente por inactividad sin confirmación del usuario. Campo closureReason.")}</div>
        <div class="ttdb-kv">${fmtN(noFB)}</div>
        <div class="ttdb-ksub">${pctN(noFB,closed.length||1)}% de cerradas</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-acc" style="--c:#00CFB9">
        <div class="ttdb-kl">T. medio resolución${ttip("Promedio de (endDate − initDate) de los topics cerrados. Solo disponible en COMPLETED y RESOLVED con endDate. Campo endDate de topics.")}</div>
        <div class="ttdb-kv" style="color:#00CFB9;font-size:22px">${fmtDays(avgMs)}</div>
        <div class="ttdb-ksub">${resTimes.length} con fecha de cierre</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-rose">
        <div class="ttdb-kl">⚠ En riesgo${ttip("IN_PROGRESS con taskDueDate ≤ ahora + 48h. Consultas activas que vencen en menos de 48h o ya vencidas. Campo taskDueDate de topics.")}</div>
        <div class="ttdb-kv">${fmtN(riesgo)}</div>
        <div class="ttdb-ksub">vence en &lt;48h</div>
      </div>
    `;
  }

  function dashRenderServiceBars(items) {
    const el = document.getElementById("ttdb-cons-services");
    if (!el) return;
    const counts = {};
    items.forEach(i => { counts[i.resolverService] = (counts[i.resolverService]||0)+1; });
    const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
    const maxC = sorted[0]?.[1] || 1;
    const total = items.length || 1;
    const svcColors = ["#00C4E9","#7c3aed","#00CFB9","#f4c53d","#e83e8c","#30BBE2","#a78bfa","#34d399","#fb923c","#60a5fa","#f472b6","#4ade80","#facc15","#c084fc","#38bdf8"];
    el.innerHTML = sorted.map(([name, count], idx) => {
      const color = svcColors[idx % svcColors.length];
      const w = Math.round(count / maxC * 100);
      const sel = state.dash.cons.serviceFilter === name;
      return `<div class="ttdb-type-row" style="cursor:pointer;${sel?"background:#f0faff;border-radius:6px;margin:0 -4px;padding:0 4px":""}" onclick="window.__teamerToolkit._dashSvcFilterClick('${name.replace(/'/g,"\\'")}');">
        <div class="ttdb-type-name" style="min-width:180px;max-width:180px;cursor:pointer;color:${sel?"#00C4E9":"#2c3050"}" title="${name.replace(/"/g,"&quot;")}">${name.replace(/</g,"&lt;")}</div>
        <div class="ttdb-type-bar-wrap" style="flex:1;width:auto">
          <div class="ttdb-type-bar-fill" style="width:${w}%;background:${color}"></div>
        </div>
        <div class="ttdb-type-count" style="width:44px">${fmtN(count)}</div>
        <div style="width:34px;text-align:right;font-size:9px;color:#8a9bb0;flex-shrink:0">${pctN(count,total)}%</div>
      </div>`;
    }).join("") || `<div style="text-align:center;padding:20px;color:#8a9bb0;font-size:11px">Sin datos</div>`;
  }

  function dashRenderConsultasBar(items, months) {
    const svg = document.getElementById("ttdb-cons-bar");
    if (!svg) return;
    const byM = {};
    months.forEach(m => { byM[m] = 0; });
    items.forEach(i => { if (byM[i.month]!==undefined) byM[i.month]++; });
    const maxVal = Math.max(1, ...months.map(m => byM[m]));
    const H=160, padT=8, padB=28, padL=30, padR=8, chartH=H-padT-padB;
    const W = svg.parentElement ? (svg.parentElement.clientWidth||500) : 500;
    svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
    const n = months.length, step = (W-padL-padR)/n;
    const barW = Math.max(6, step - 4);
    const mNames = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    let out = "";
    for (let t=0; t<=4; t++) {
      const y = padT + chartH - (t/4)*chartH;
      out += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="#dde3e8" stroke-width="1"/>`;
      out += `<text x="${padL-4}" y="${y+3}" text-anchor="end" font-size="8" fill="#8a9bb0">${Math.round(t/4*maxVal)}</text>`;
    }
    months.forEach((m, i) => {
      const x = padL + i*step + (step-barW)/2;
      const v = byM[m];
      const bH = v/maxVal*chartH;
      if (bH>0) out += `<rect x="${x}" y="${padT+chartH-bH}" width="${barW}" height="${bH}" fill="#00C4E9" rx="2"/>`;
      const mNum = parseInt(m.slice(5));
      out += `<text x="${x+barW/2}" y="${H-14}" text-anchor="middle" font-size="8" fill="#8a9bb0">${mNames[mNum]}</text>`;
      out += `<text x="${x+barW/2}" y="${H-4}" text-anchor="middle" font-size="7" fill="#c2cdd6">${m.slice(2,4)}</text>`;
      if (v>0) out += `<text x="${x+barW/2}" y="${padT+chartH-bH-3}" text-anchor="middle" font-size="7" fill="#8a9bb0">${v}</text>`;
    });
    svg.innerHTML = out;
  }

  function dashRenderFeedbackDonut(items) {
    const arcsEl = document.getElementById("ttdb-cons-donut-arcs");
    const legEl  = document.getElementById("ttdb-cons-dlegend");
    const totEl  = document.getElementById("ttdb-cons-donut-total");
    if (!arcsEl) return;
    const withFB = items.filter(i => i.closureReason === "Resolved with feedback").length;
    const noFB   = items.filter(i => i.closureReason === "Inactivity without feedback").length;
    const pending= items.filter(i => i.status === "IN_PROGRESS").length;
    const counts = { withFB, noFB, pending };
    const colors = { withFB:"#00CFB9", noFB:"#f4c53d", pending:"#00C4E9" };
    const labels = { withFB:"Con feedback", noFB:"Sin feedback", pending:"Pendiente" };
    const total  = items.length || 1;
    const r=36, cx=50, cy=50, circ=2*Math.PI*r;
    let offset=0, arcs="";
    for (const [k,v] of Object.entries(counts)) {
      const dash = v/total*circ;
      arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors[k]}" stroke-width="16" stroke-dasharray="${dash} ${circ-dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += dash;
    }
    arcsEl.innerHTML = arcs;
    if (totEl) totEl.textContent = fmtN(items.length);
    if (legEl) legEl.innerHTML = Object.entries(counts).map(([k,v]) =>
      `<div class="ttdb-dl"><div class="ttdb-dl-dot" style="background:${colors[k]}"></div><span>${labels[k]}</span><span class="ttdb-dl-val">${fmtN(v)}<span style="font-weight:400;color:#8a9bb0;font-size:9px"> (${pctN(v,items.length)}%)</span></span></div>`
    ).join("");
  }

  function dashRenderComplexity(items) {
    const el = document.getElementById("ttdb-cons-cplx");
    if (!el) return;
    const defs = [
      { key:"LOW",    label:"Baja",   color:"#00CFB9" },
      { key:"MEDIUM", label:"Media",  color:"#f4c53d" },
      { key:"HIGH",   label:"Alta",   color:"#e83e8c" },
    ];
    const counts = {};
    items.forEach(i => { if (i.complexity) counts[i.complexity] = (counts[i.complexity]||0)+1; });
    const hasData = defs.some(d => counts[d.key]);
    if (!hasData) {
      el.innerHTML = `<div style="color:#8a9bb0;font-size:11px;padding:8px 0">Sin datos de complejidad (solo disponible en consultas cerradas)</div>`;
      return;
    }
    el.innerHTML = defs.map(({key,label,color}) => {
      const v = counts[key]||0;
      const t = items.filter(i=>i.complexity).length||1;
      return `<div class="ttdb-cplx-item">
        <div class="ttdb-cplx-val" style="color:${color}">${fmtN(v)}</div>
        <div class="ttdb-cplx-lbl">${label}</div>
        <div style="font-size:9px;color:#8a9bb0;margin-top:2px">${pctN(v,t)}%</div>
      </div>`;
    }).join("");
  }

  function dashRenderOpenClose(items, months) {
    const svg = document.getElementById("ttdb-cons-openclose");
    if (!svg) return;
    const byM = {};
    months.forEach(m => { byM[m] = { open:0, close:0 }; });
    items.forEach(i => {
      if (byM[i.month]) byM[i.month].open++;
      if (i.endDate) {
        const cm = i.endDate.slice(0,7);
        if (byM[cm]) byM[cm].close++;
      }
    });
    const maxV = Math.max(1, ...months.map(m => Math.max(byM[m].open, byM[m].close)));
    const H=180, padT=16, padB=30, padL=32, padR=8, chartH=H-padT-padB;
    const W = svg.parentElement ? (svg.parentElement.clientWidth||700) : 700;
    svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
    const n = months.length, step=(W-padL-padR)/n, grpW=Math.min(step-4, 32), bW=Math.floor(grpW/2)-1;
    const mNames=["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    let out="";
    for (let t=0;t<=4;t++) {
      const y = padT+chartH-(t/4)*chartH;
      out += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="#dde3e8" stroke-width="1"/>`;
      out += `<text x="${padL-4}" y="${y+3}" text-anchor="end" font-size="8" fill="#8a9bb0">${Math.round(t/4*maxV)}</text>`;
    }
    months.forEach((m,i) => {
      const cx = padL + i*step + step/2;
      const {open,close} = byM[m];
      const oH = open/maxV*chartH, cH = close/maxV*chartH;
      const x0 = cx - grpW/2, x1 = x0 + bW + 1;
      if (oH>0) out+=`<rect x="${x0}" y="${padT+chartH-oH}" width="${bW}" height="${oH}" fill="#00C4E9" rx="2"/>`;
      if (cH>0) out+=`<rect x="${x1}" y="${padT+chartH-cH}" width="${bW}" height="${cH}" fill="#00CFB9" rx="2"/>`;
      const mNum=parseInt(m.slice(5));
      out+=`<text x="${cx}" y="${H-14}" text-anchor="middle" font-size="8" fill="#8a9bb0">${mNames[mNum]}</text>`;
      out+=`<text x="${cx}" y="${H-4}" text-anchor="middle" font-size="7" fill="#c2cdd6">${m.slice(2,4)}</text>`;
      if (open>0) out+=`<text x="${x0+bW/2}" y="${padT+chartH-oH-3}" text-anchor="middle" font-size="7" fill="#00C4E9">${open}</text>`;
      if (close>0) out+=`<text x="${x1+bW/2}" y="${padT+chartH-cH-3}" text-anchor="middle" font-size="7" fill="#00CFB9">${close}</text>`;
      // net indicator
      const net = close-open;
      if (net!==0) out+=`<text x="${cx}" y="${padT+chartH+10}" text-anchor="middle" font-size="7" fill="${net>0?"#00CFB9":"#e83e8c"}">${net>0?"+":""}${net}</text>`;
    });
    svg.innerHTML = out;
  }

  function dashRenderTimeHist(items) {
    const el = document.getElementById("ttdb-cons-timehist");
    if (!el) return;
    const buckets = [
      { lbl:"< 2h",   max:2,       color:"#00CFB9" },
      { lbl:"2h–1d",  max:24,      color:"#00C4E9" },
      { lbl:"1–3d",   max:72,      color:"#7c3aed" },
      { lbl:"3–7d",   max:168,     color:"#f4c53d" },
      { lbl:"7–30d",  max:720,     color:"#e07b39" },
      { lbl:"> 30d",  max:Infinity,color:"#e83e8c" },
    ];
    const counts = buckets.map(() => 0);
    let total = 0;
    items.forEach(i => {
      if (!i.endDate || !i.initDate) return;
      const h = (new Date(i.endDate) - new Date(i.initDate)) / 3600000;
      if (!isFinite(h) || h < 0) return;
      total++;
      for (let b = 0; b < buckets.length; b++) {
        if (h < buckets[b].max) { counts[b]++; break; }
      }
    });
    if (!total) { el.innerHTML=`<div style="color:#8a9bb0;font-size:11px;padding:8px 0">Sin datos de cierre</div>`; return; }
    const maxC = Math.max(...counts, 1);
    el.innerHTML = buckets.map((b,i) =>
      `<div class="ttdb-thist-row">
        <div class="ttdb-thist-lbl">${b.lbl}</div>
        <div class="ttdb-thist-bar-wrap"><div class="ttdb-thist-bar-fill" style="width:${Math.round(counts[i]/maxC*100)}%;background:${b.color}"></div></div>
        <div class="ttdb-thist-val">${counts[i]}</div>
        <div class="ttdb-thist-pct">${pctN(counts[i],total)}%</div>
      </div>`
    ).join("");
  }

  function dashRenderTimeByService(items) {
    const el = document.getElementById("ttdb-cons-timebysvc");
    if (!el) return;
    const svcH = {};
    items.forEach(i => {
      if (!i.endDate || !i.initDate) return;
      const h = (new Date(i.endDate) - new Date(i.initDate)) / 3600000;
      if (!isFinite(h) || h < 0) return;
      if (!svcH[i.resolverService]) svcH[i.resolverService] = [];
      svcH[i.resolverService].push(h);
    });
    const avgs = Object.entries(svcH)
      .map(([s,hs]) => [s, hs.reduce((a,b)=>a+b,0)/hs.length, hs.length])
      .sort((a,b)=>a[1]-b[1]).slice(0,10);
    if (!avgs.length) { el.innerHTML=`<div style="color:#8a9bb0;font-size:11px;padding:8px 0">Sin datos</div>`; return; }
    const maxA = avgs[avgs.length-1][1]||1;
    const fmtH = h => h<1 ? "<1h" : h<24 ? Math.round(h)+"h" : (h/24).toFixed(1)+"d";
    el.innerHTML = avgs.map(([s,avg,cnt]) =>
      `<div class="ttdb-thist-row">
        <div class="ttdb-thist-lbl" style="width:90px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s}">${s}</div>
        <div class="ttdb-thist-bar-wrap"><div class="ttdb-thist-bar-fill" style="width:${Math.round(avg/maxA*100)}%;background:#7c3aed"></div></div>
        <div class="ttdb-thist-val" style="width:40px">${fmtH(avg)}</div>
        <div class="ttdb-thist-pct" style="width:32px;color:#c2cdd6">${cnt}×</div>
      </div>`
    ).join("");
  }

  function dashRenderFeedbackTrend(items, months) {
    const svg = document.getElementById("ttdb-cons-fb-trend");
    if (!svg) return;
    const byM = {};
    months.forEach(m => { byM[m] = { closed:0, fb:0 }; });
    items.forEach(i => {
      if (!byM[i.month] || i.status === "IN_PROGRESS") return;
      byM[i.month].closed++;
      if (i.closureReason === "Resolved with feedback") byM[i.month].fb++;
    });
    const rates = months.map(m => byM[m].closed > 0 ? Math.round(byM[m].fb / byM[m].closed * 100) : null);
    const H=130, padT=14, padB=28, padL=28, padR=8, chartH=H-padT-padB;
    const W = svg.parentElement ? (svg.parentElement.clientWidth||600) : 600;
    svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
    const n = months.length, step=(W-padL-padR)/n, barW=Math.max(6,step-4);
    const mNames = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    let out = "";
    // grid & 50% reference line
    [0,25,50,75,100].forEach(pct => {
      const y = padT + chartH - (pct/100)*chartH;
      out += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="${pct===50?"#00C4E9":"#dde3e8"}" stroke-width="${pct===50?"1.5":"1"}" stroke-dasharray="${pct===50?"4 3":""}"/>`;
      out += `<text x="${padL-4}" y="${y+3}" text-anchor="end" font-size="8" fill="${pct===50?"#00C4E9":"#8a9bb0"}">${pct}%</text>`;
    });
    months.forEach((m, i) => {
      const x = padL + i*step + (step-barW)/2;
      const r = rates[i];
      const bH = r !== null ? (r/100)*chartH : 0;
      const color = r === null ? "#edf0f3" : r >= 60 ? "#00CFB9" : r >= 35 ? "#f4c53d" : "#e83e8c";
      if (bH > 0) out += `<rect x="${x}" y="${padT+chartH-bH}" width="${barW}" height="${bH}" fill="${color}" rx="2" opacity="${r===null?0.4:1}"/>`;
      const mNum = parseInt(m.slice(5));
      out += `<text x="${x+barW/2}" y="${H-14}" text-anchor="middle" font-size="8" fill="#8a9bb0">${mNames[mNum]}</text>`;
      out += `<text x="${x+barW/2}" y="${H-4}" text-anchor="middle" font-size="7" fill="#c2cdd6">${m.slice(2,4)}</text>`;
      if (r !== null) out += `<text x="${x+barW/2}" y="${padT+chartH-bH-3}" text-anchor="middle" font-size="7" font-weight="700" fill="${color}">${r}%</text>`;
      else out += `<text x="${x+barW/2}" y="${padT+chartH/2}" text-anchor="middle" font-size="7" fill="#c2cdd6">—</text>`;
    });
    svg.innerHTML = out;
  }

  function dashRenderRequesters(items) {
    const el = document.getElementById("ttdb-cons-requesters");
    if (!el) return;
    const counts = {};
    items.forEach(i => { if (i.sourceService) counts[i.sourceService] = (counts[i.sourceService]||0)+1; });
    const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const maxV = top[0]?.[1]||1, total = items.length||1;
    el.innerHTML = top.map(([name,count]) =>
      `<div class="ttdb-type-row">
        <div class="ttdb-type-name" title="${name.replace(/"/g,"&quot;")}">${name.replace(/</g,"&lt;")}</div>
        <div class="ttdb-type-bar-wrap" style="flex:1;width:auto"><div class="ttdb-type-bar-fill" style="width:${Math.round(count/maxV*100)}%;background:#00C4E9"></div></div>
        <div class="ttdb-type-count" style="width:36px">${fmtN(count)}</div>
        <div style="width:30px;text-align:right;font-size:9px;color:#8a9bb0;flex-shrink:0">${pctN(count,total)}%</div>
      </div>`
    ).join("") || `<div style="text-align:center;padding:16px;color:#8a9bb0;font-size:11px">Sin datos</div>`;
  }

  function dashRenderClosureTypes(items) {
    const el = document.getElementById("ttdb-cons-closure");
    if (!el) return;
    const closed = items.filter(i => i.closureType);
    if (!closed.length) { el.innerHTML = `<div style="text-align:center;padding:16px;color:#8a9bb0;font-size:11px">Sin datos (solo en cerradas)</div>`; return; }
    const counts = {};
    closed.forEach(i => { counts[i.closureType] = (counts[i.closureType]||0)+1; });
    const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
    const maxV = sorted[0]?.[1]||1, total = closed.length;
    const colors = {"Resuelto":"#00CFB9","Leer manual":"#00C4E9","Asignación equivocada":"#f4c53d","Duplicado":"#e83e8c","Petición por Canal incorrecto":"#7c3aed"};
    el.innerHTML = sorted.map(([name,count]) => {
      const color = colors[name]||"#8a9bb0";
      return `<div class="ttdb-type-row">
        <div class="ttdb-type-name" title="${name.replace(/"/g,"&quot;")}" style="min-width:140px;max-width:140px">${name.replace(/</g,"&lt;")}</div>
        <div class="ttdb-type-bar-wrap" style="flex:1;width:auto"><div class="ttdb-type-bar-fill" style="width:${Math.round(count/maxV*100)}%;background:${color}"></div></div>
        <div class="ttdb-type-count" style="width:36px">${fmtN(count)}</div>
        <div style="width:30px;text-align:right;font-size:9px;color:#8a9bb0;flex-shrink:0">${pctN(count,total)}%</div>
      </div>`;
    }).join("");
  }

  function dashRenderPPM(items) {
    const el = document.getElementById("ttdb-cons-ppm");
    if (!el) return;
    const counts = {};
    items.forEach(i => { const p = i.ppm||"(sin PPM)"; counts[p]=(counts[p]||0)+1; });
    const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
    const maxV = sorted[0]?.[1]||1, total = items.length||1;
    const colors = {"No crítico":"#8a9bb0","COSMOS":"#00C4E9","Normativo":"#7c3aed","TOP50":"#f4c53d","Tier 1":"#e83e8c","(sin PPM)":"#edf0f3"};
    el.innerHTML = sorted.map(([name,count]) => {
      const color = colors[name]||"#00C4E9";
      return `<div class="ttdb-type-row">
        <div class="ttdb-type-name" style="min-width:90px;max-width:90px">${name}</div>
        <div class="ttdb-type-bar-wrap" style="flex:1;width:auto"><div class="ttdb-type-bar-fill" style="width:${Math.round(count/maxV*100)}%;background:${color}"></div></div>
        <div class="ttdb-type-count" style="width:36px">${fmtN(count)}</div>
        <div style="width:30px;text-align:right;font-size:9px;color:#8a9bb0;flex-shrink:0">${pctN(count,total)}%</div>
      </div>`;
    }).join("") || `<div style="text-align:center;padding:16px;color:#8a9bb0;font-size:11px">Sin datos</div>`;
  }

  // ── SLA & tipos de solicitud (cross with processes) ───────────────
  function dashRenderSLAKPIs(filtered) {
    const el = document.getElementById("ttdb-sla-kpis");
    const badge = document.getElementById("ttdb-join-badge");
    if (!el) return;
    const joined   = filtered.filter(i => i.processDueDate);
    const coverage = filtered.length ? Math.round(joined.length / filtered.length * 100) : 0;
    if (badge) badge.textContent = joined.length ? `${joined.length} topics cruzados con procesos (${coverage}%)` : "sin cruce — carga la pestaña Volumetría primero";

    if (!joined.length) {
      el.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:14px;color:#8a9bb0;font-size:11px">Sin datos de SLA — los procesos y consultas deben estar cargados en paralelo. Pulsa Demo o recarga la página.</div>`;
      return;
    }

    const now = Date.now();
    const closed = joined.filter(i => i.endDate);
    const open   = joined.filter(i => !i.endDate);

    // Closed: compliant if endDate ≤ processDueDate
    const closedOk    = closed.filter(i => new Date(i.endDate) <= new Date(i.processDueDate)).length;
    const closedBreak = closed.length - closedOk;
    const slaRate     = closed.length ? Math.round(closedOk / closed.length * 100) : null;

    // Open: already past SLA (processStatus Expired OR now > processDueDate)
    const openBreached = open.filter(i => i.processStatus === "Expired" || (i.processDueDate && now > new Date(i.processDueDate))).length;

    // Avg SLA window (processDueDate - initDate in days)
    const windows = joined.map(i => {
      const d = (new Date(i.processDueDate) - new Date(i.initDate)) / 86400000;
      return isFinite(d) && d > 0 ? d : null;
    }).filter(Boolean);
    const avgWindow = windows.length ? (windows.reduce((a,b)=>a+b,0)/windows.length).toFixed(1) : null;

    el.innerHTML = `
      <div class="ttdb-kcard ttdb-kc-grn">
        <div class="ttdb-kl">Cumplimiento SLA</div>
        <div class="ttdb-kv">${slaRate !== null ? slaRate+"%" : "—"}</div>
        <div class="ttdb-ksub">${closedOk} de ${closed.length} cerradas a tiempo</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-rose">
        <div class="ttdb-kl">Incumplimientos</div>
        <div class="ttdb-kv">${fmtN(closedBreak)}</div>
        <div class="ttdb-ksub">cerradas fuera de plazo</div>
      </div>
      <div class="ttdb-kcard ttdb-kcard-red">
        <div class="ttdb-kl">Abiertas vencidas</div>
        <div class="ttdb-kv">${fmtN(openBreached)}</div>
        <div class="ttdb-ksub">IN_PROGRESS con SLA expirado</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-acc">
        <div class="ttdb-kl">Plazo medio SLA</div>
        <div class="ttdb-kv">${avgWindow ? avgWindow+"d" : "—"}</div>
        <div class="ttdb-ksub">ventana media processDueDate</div>
      </div>
    `;
  }

  function dashRenderSLAByService(filtered) {
    const el = document.getElementById("ttdb-sla-service");
    if (!el) return;
    const joined = filtered.filter(i => i.processDueDate && i.endDate);
    if (!joined.length) { el.innerHTML = `<div style="text-align:center;padding:16px;color:#8a9bb0;font-size:11px">Sin datos cruzados</div>`; return; }

    const map = {}; // service → { ok, breach }
    for (const i of joined) {
      const s = i.resolverService || "Desconocido";
      if (!map[s]) map[s] = { ok:0, breach:0 };
      if (new Date(i.endDate) <= new Date(i.processDueDate)) map[s].ok++;
      else map[s].breach++;
    }
    const rows = Object.entries(map)
      .map(([s,v]) => ({ s, ...v, total: v.ok+v.breach, rate: Math.round(v.ok/(v.ok+v.breach)*100) }))
      .filter(r => r.total >= 2)
      .sort((a,b) => a.rate - b.rate); // worst first

    const maxTotal = Math.max(...rows.map(r=>r.total), 1);
    el.innerHTML = rows.map(r => {
      const okW  = (r.ok    / r.total * 100).toFixed(1);
      const brW  = (r.breach / r.total * 100).toFixed(1);
      const color = r.rate >= 80 ? "#00CFB9" : r.rate >= 50 ? "#f4c53d" : "#e83e8c";
      return `<div class="ttdb-imp-row">
        <div class="ttdb-imp-name" title="${r.s}">${r.s}</div>
        <div class="ttdb-imp-stack" style="flex:0 0 ${Math.max(Math.round(r.total/maxTotal*160),16)}px">
          <div class="ttdb-imp-seg" style="width:${okW}%;background:#00CFB9"></div>
          <div class="ttdb-imp-seg" style="width:${brW}%;background:#e83e8c"></div>
        </div>
        <div style="width:34px;text-align:right;font-weight:700;font-size:10px;flex-shrink:0;color:${color}">${r.rate}%</div>
        <div class="ttdb-imp-pct">${fmtN(r.total)}</div>
      </div>`;
    }).join("") || `<div style="text-align:center;padding:16px;color:#8a9bb0;font-size:11px">Sin suficientes datos (mínimo 2 por servicio)</div>`;
  }

  function dashRenderRequestTypes(filtered) {
    const el = document.getElementById("ttdb-req-types");
    if (!el) return;
    const withType = filtered.filter(i => i.requestType);
    if (!withType.length) { el.innerHTML = `<div style="text-align:center;padding:16px;color:#8a9bb0;font-size:11px">Sin datos cruzados</div>`; return; }

    const map = {};
    for (const i of withType) {
      const t = i.requestType || "Sin tipo";
      if (!map[t]) map[t] = { total:0, imp:0 };
      map[t].total++;
      if (isImprocedente(i)) map[t].imp++;
    }
    const rows = Object.entries(map).sort((a,b)=>b[1].total-a[1].total).slice(0,10);
    const maxTotal = rows[0]?.[1].total || 1;
    el.innerHTML = rows.map(([type, v]) => {
      const pct  = Math.round(v.total / maxTotal * 100);
      const impPct = v.total ? Math.round(v.imp / v.total * 100) : 0;
      const color = impPct > 40 ? "#e83e8c" : impPct > 20 ? "#f4a53d" : "#00CFB9";
      return `<div class="ttdb-type-row" title="${type}">
        <div class="ttdb-type-name">${type}</div>
        <div class="ttdb-type-bar-wrap" style="width:90px"><div class="ttdb-type-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="ttdb-type-count">${fmtN(v.total)}</div>
        <div style="width:30px;text-align:right;font-size:9px;color:${impPct>20?"#e83e8c":"#8a9bb0"};flex-shrink:0">${impPct}%↯</div>
      </div>`;
    }).join("") || `<div style="text-align:center;padding:16px;color:#8a9bb0;font-size:11px">Sin datos</div>`;
  }

  // ── Calidad & Routing: Improcedentes ──────────────────────────────
  // Procedentes = Resuelto, Otros, Incidencia — todo lo demás es improcedente
  const PROC_TYPES = new Set(["Resuelto","Otros","Incidencia"]);
  function isImprocedente(item) {
    return item.closureType && !PROC_TYPES.has(item.closureType);
  }

  // Paleta de colores para tipos de cierre
  const CLOSURE_COLORS = {
    "Resuelto":              "#00CFB9",
    "Otros":                 "#8ab4f8",
    "Incidencia":            "#a8d5a2",
    "Asignación equivocada": "#e83e8c",
    "Leer manual":           "#f4a53d",
    "Duplicado":             "#7c3aed",
    "No aplica":             "#c2cdd6",
  };
  function closureColor(name) {
    return CLOSURE_COLORS[name] || "#e83e8c";
  }

  function dashRenderImpKPIs(closed) {
    const el = document.getElementById("ttdb-imp-kpis");
    if (!el) return;
    const imps = closed.filter(isImprocedente);
    const total = closed.length;
    const pctImp = total ? Math.round(imps.length / total * 100) : 0;
    const lowImp = imps.filter(i => i.complexity === "LOW").length;
    // top solicitante improcedente
    const bySol = {};
    for (const i of imps) { const s = i.sourceService || "Desconocido"; bySol[s] = (bySol[s]||0)+1; }
    const topSol = Object.entries(bySol).sort((a,b)=>b[1]-a[1])[0];
    el.innerHTML = `
      <div class="ttdb-kcard ttdb-kcard-red">
        <div class="ttdb-kl">Improcedentes</div>
        <div class="ttdb-kv">${fmtN(imps.length)}</div>
        <div class="ttdb-ksub">${pctImp}% del total cerrado</div>
      </div>
      <div class="ttdb-kcard ttdb-kcard-red">
        <div class="ttdb-kl">Evitables (LOW)</div>
        <div class="ttdb-kv">${fmtN(lowImp)}</div>
        <div class="ttdb-ksub">complejidad baja — routing directo</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-amb">
        <div class="ttdb-kl">Top solicitante</div>
        <div class="ttdb-kv" style="font-size:14px;letter-spacing:-.3px">${topSol?topSol[0]:"—"}</div>
        <div class="ttdb-ksub">${topSol?topSol[1]+" improcedentes":""}</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-pur">
        <div class="ttdb-kl">Tipos distintos</div>
        <div class="ttdb-kv">${new Set(imps.map(i=>i.closureType)).size}</div>
        <div class="ttdb-ksub">tipos de cierre improcedente</div>
      </div>
    `;
  }

  function dashRenderImpStacked(closed) {
    const el = document.getElementById("ttdb-imp-stacked");
    if (!el) return;
    // Build per-solicitante breakdown by closureType
    const map = {}; // { solicitante: { closureType: count } }
    for (const i of closed) {
      const s = i.sourceService || "Desconocido";
      const c = i.closureType || "Sin cierre";
      if (!map[s]) map[s] = {};
      map[s][c] = (map[s][c] || 0) + 1;
    }
    // Sort by total improcedentes desc
    const rows = Object.entries(map).map(([sol, byType]) => {
      const total = Object.values(byType).reduce((a,b)=>a+b,0);
      const imp   = Object.entries(byType).filter(([t])=>!PROC_TYPES.has(t)).reduce((a,[,v])=>a+v,0);
      return { sol, byType, total, imp };
    }).sort((a,b) => b.imp - a.imp).slice(0,12);

    if (!rows.length) { el.innerHTML = `<div style="text-align:center;padding:16px;color:#8a9bb0;font-size:11px">Sin datos</div>`; return; }

    // Collect all closure types seen, ordered: proc first, then imp
    const allTypes = [...new Set(rows.flatMap(r => Object.keys(r.byType)))];
    allTypes.sort((a,b) => {
      const pa = PROC_TYPES.has(a) ? 0 : 1, pb = PROC_TYPES.has(b) ? 0 : 1;
      return pa - pb || a.localeCompare(b);
    });

    // Legend
    const legendHtml = allTypes.map(t =>
      `<span style="display:inline-flex;align-items:center;gap:3px;font-size:9px;color:#8a9bb0;margin-right:8px"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${closureColor(t)};flex-shrink:0"></span>${t}</span>`
    ).join("");

    const maxTotal = Math.max(...rows.map(r => r.total), 1);
    el.innerHTML = `<div style="display:flex;flex-wrap:wrap;margin-bottom:8px">${legendHtml}</div>` +
      rows.map(r => {
        const segments = allTypes.map(t => {
          const cnt = r.byType[t] || 0;
          if (!cnt) return "";
          const w = (cnt / r.total * 100).toFixed(1);
          const isImp = !PROC_TYPES.has(t);
          return `<div class="ttdb-imp-seg" style="width:${w}%;background:${closureColor(t)};${isImp?"opacity:1":"opacity:.85"}" title="${t}: ${cnt}"></div>`;
        }).join("");
        const barW = Math.round(r.total / maxTotal * 100);
        return `<div class="ttdb-imp-row">
          <div class="ttdb-imp-name" title="${r.sol}">${r.sol}</div>
          <div class="ttdb-imp-stack" style="flex:0 0 ${Math.max(barW,8)}px;max-width:200px">${segments}</div>
          <div class="ttdb-imp-val">${r.imp ? fmtN(r.imp) : ""}</div>
          <div class="ttdb-imp-pct" style="color:${r.imp>0?"#e83e8c":"#c2cdd6"}">${r.total ? Math.round(r.imp/r.total*100) : 0}%</div>
        </div>`;
      }).join("");
  }

  function dashRenderImpPPM(imps) {
    const el = document.getElementById("ttdb-imp-ppm");
    if (!el) return;
    const map = {};
    for (const i of imps) { const p = i.ppm || "Sin PPM"; map[p] = (map[p]||0)+1; }
    const rows = Object.entries(map).sort((a,b)=>b[1]-a[1]);
    const total = rows.reduce((s,[,c])=>s+c,0);
    const PPM_COLORS = {"No crítico":"#c2cdd6","COSMOS":"#00C4E9","Normativo":"#f4c53d","TOP50":"#f4a53d","Tier 1":"#e83e8c","Sin PPM":"#edf0f3"};
    el.innerHTML = rows.map(([ppm, cnt]) => {
      const pct = total ? Math.round(cnt/total*100) : 0;
      const color = PPM_COLORS[ppm] || "#8ab4f8";
      return `<div class="ttdb-type-row">
        <div class="ttdb-type-name">${ppm}</div>
        <div class="ttdb-type-bar-wrap" style="width:100px"><div class="ttdb-type-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="ttdb-type-count">${fmtN(cnt)}</div>
        <div style="width:28px;text-align:right;font-size:9px;color:#8a9bb0;flex-shrink:0">${pct}%</div>
      </div>`;
    }).join("") || `<div style="text-align:center;padding:16px;color:#8a9bb0;font-size:11px">Sin datos</div>`;
  }

  function dashRenderImpCplx(imps) {
    const el = document.getElementById("ttdb-imp-cplx");
    if (!el) return;
    const LEVELS = [
      { key:"LOW",    label:"LOW — evitable",  color:"#e83e8c", note:"enrutamiento o doc." },
      { key:"MEDIUM", label:"MEDIUM",           color:"#f4a53d", note:"valorar casuística" },
      { key:"HIGH",   label:"HIGH",             color:"#7c3aed", note:"caso límite" },
      { key:null,     label:"Sin clasificar",   color:"#c2cdd6", note:"aún abierto o sin datos" },
    ];
    const counts = {};
    for (const i of imps) { const k = i.complexity || null; counts[k] = (counts[k]||0)+1; }
    const total = Object.values(counts).reduce((a,b)=>a+b,0);
    el.innerHTML = `<div class="ttdb-cplx">` +
      LEVELS.map(({key,label,color,note}) => {
        const cnt = counts[key] || 0;
        const pct = total ? Math.round(cnt/total*100) : 0;
        return `<div class="ttdb-cplx-item" style="border-top:3px solid ${color}">
          <div class="ttdb-cplx-val" style="color:${color}">${fmtN(cnt)}</div>
          <div class="ttdb-cplx-lbl">${label}</div>
          <div style="font-size:9px;color:#8a9bb0;margin-top:2px">${pct}% · ${note}</div>
        </div>`;
      }).join("") +
    `</div>`;
  }

  // ── Análisis de Tiempos ────────────────────────────────────────────

  function percentile(arr, p) {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const i = (p / 100) * (s.length - 1);
    const lo = Math.floor(i), hi = Math.ceil(i);
    return s[lo] + (s[hi] - s[lo]) * (i - lo);
  }

  function fmtHours(h) {
    if (h === null || h === undefined || !isFinite(h)) return "—";
    if (h < 1)   return "<1h";
    if (h < 24)  return Math.round(h) + "h";
    if (h < 72)  return (h / 24).toFixed(1) + "d";
    return Math.round(h / 24) + "d";
  }

  function renderTiempos() {
    if (!state.dash.cons.loaded) return;
    const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear()-1);
    const svc      = state.dash.cons.serviceFilter;
    const inPeriod = state.dash.cons.items.filter(i => new Date(i.initDate) >= cutoff);
    const filtered = svc === "all" ? inPeriod : inPeriod.filter(i => i.resolverService === svc);
    const closed   = filtered.filter(i => i.endDate && i.initDate);
    const resHours = closed.map(i => {
      const h = (new Date(i.endDate) - new Date(i.initDate)) / 3600000;
      return isFinite(h) && h >= 0 ? h : null;
    }).filter(x => x !== null);
    const months = dashBuildMonths(state.dash.timesWindowM || 12);
    dashRenderTimesKPIs(resHours, filtered);
    dashRenderTimesTrend(filtered, months);
    dashRenderTimesHist(resHours);
    dashRenderTimesAging(filtered.filter(i => i.status === "IN_PROGRESS"));
    dashRenderTimesByService(filtered);
    dashRenderTimesByComplexity(filtered);
    dashRenderTimesByWeekday(closed);
    dashRenderTimesBottleneck(filtered);
    const main = document.getElementById("ttdb-times-main");
    if (main) main.style.display = "flex";
  }

  function dashRenderTimesKPIs(resHours, filtered) {
    const el = document.getElementById("ttdb-times-kpis");
    if (!el) return;
    const p50  = percentile(resHours, 50);
    const avg  = resHours.length ? resHours.reduce((a,b)=>a+b,0)/resHours.length : null;
    const p90  = percentile(resHours, 90);
    const fast = resHours.filter(h => h <= 24).length;
    const slow = resHours.filter(h => h > 168).length;
    const pctFast = resHours.length ? Math.round(fast/resHours.length*100) : null;
    const pctSlow = resHours.length ? Math.round(slow/resHours.length*100) : null;
    const openOld = filtered.filter(i =>
      i.status === "IN_PROGRESS" && i.initDate &&
      (Date.now()-new Date(i.initDate))/3600000 > 168
    ).length;
    const skew = (avg && p50 && p50 > 0) ? avg/p50 : null;
    el.innerHTML = `
      <div class="ttdb-kcard ttdb-kc-grn">
        <div class="ttdb-kl">Mediana p50${ttip("El 50% de las consultas cerradas se resuelve en este tiempo o menos. Métrica robusta frente a outliers — úsala como referencia principal de rendimiento.")}</div>
        <div class="ttdb-kv" style="font-size:22px">${fmtHours(p50)}</div>
        <div class="ttdb-ksub">${resHours.length} con fecha cierre</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-acc">
        <div class="ttdb-kl">Promedio${ttip("Media aritmética de (endDate − initDate). Más sensible a outliers que la mediana. Si promedio >> p50, hay pocos casos muy lentos inflando la media.")}</div>
        <div class="ttdb-kv" style="font-size:22px">${fmtHours(avg)}</div>
        <div class="ttdb-ksub">${skew ? (skew > 1.8 ? "sesgado por lentas" : skew > 1.3 ? "cola larga" : "distribución uniforme") : "—"}</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-amb">
        <div class="ttdb-kl">P90${ttip("El 90% de las consultas cerradas se resuelve en este tiempo o menos. Define el techo del rendimiento normal — lo que supera este umbral son los casos problemáticos que hay que investigar.")}</div>
        <div class="ttdb-kv" style="font-size:22px">${fmtHours(p90)}</div>
        <div class="ttdb-ksub">límite superior normal</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-grn" style="opacity:.9">
        <div class="ttdb-kl">Rápidas ≤24h${ttip("% de consultas cerradas en 24 horas o menos. Consultas bien enrutadas desde el primer momento o de resolución directa con documentación.")}</div>
        <div class="ttdb-kv" style="font-size:22px">${pctFast !== null ? pctFast+"%" : "—"}</div>
        <div class="ttdb-ksub">${fast} cerradas en ≤1 día</div>
      </div>
      <div class="ttdb-kcard ttdb-kc-rose">
        <div class="ttdb-kl">Lentas >7d${ttip("% de consultas cerradas que tardaron más de 7 días. Además hay ${openOld} actualmente abiertas con más de 7 días — son el backlog problemático que más coste genera.")}</div>
        <div class="ttdb-kv" style="font-size:22px">${pctSlow !== null ? pctSlow+"%" : "—"}</div>
        <div class="ttdb-ksub">${slow} cerradas · ${openOld} abiertas >7d</div>
      </div>
    `;
  }

  function dashRenderTimesTrend(items, months) {
    const svg = document.getElementById("ttdb-times-trend");
    if (!svg) return;
    const byM = {};
    months.forEach(m => { byM[m] = []; });
    items.forEach(i => {
      if (!i.endDate || !i.initDate) return;
      const h = (new Date(i.endDate) - new Date(i.initDate)) / 3600000;
      if (!isFinite(h) || h < 0) return;
      const m = i.initDate.slice(0,7);
      if (byM[m] !== undefined) byM[m].push(h);
    });
    const mData = months.map(m => {
      const hs = byM[m] || [];
      return {
        m,
        avg: hs.length ? hs.reduce((a,b)=>a+b,0)/hs.length : null,
        p50: percentile(hs, 50),
        p90: percentile(hs, 90),
        n:   hs.length,
      };
    });
    const allVals = mData.flatMap(d => [d.avg, d.p50, d.p90]).filter(x => x !== null && isFinite(x));
    if (!allVals.length) {
      svg.innerHTML = `<text x="50%" y="60" text-anchor="middle" font-size="11" fill="#8a9bb0">Sin datos de resolución — consultas cerradas aún sin fecha de cierre</text>`;
      return;
    }
    const maxVal = Math.max(...allVals) * 1.12 || 1;
    const H=180, padT=18, padB=34, padL=44, padR=14, chartH=H-padT-padB;
    const W = svg.parentElement ? (svg.parentElement.clientWidth||700) : 700;
    svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
    const n = months.length, step = (W-padL-padR)/n;
    const mNames=["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    let out = "";
    // Grid
    [0,.25,.5,.75,1].forEach(t => {
      const v = maxVal*t, y = padT + chartH - t*chartH;
      out += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="#dde3e8" stroke-width="1"/>`;
      out += `<text x="${padL-4}" y="${y+3}" text-anchor="end" font-size="8" fill="#8a9bb0">${fmtHours(v)}</text>`;
    });
    // Month labels
    months.forEach((m, i) => {
      const cx = padL + i*step + step/2;
      const mNum = parseInt(m.slice(5));
      out += `<text x="${cx}" y="${H-17}" text-anchor="middle" font-size="8" fill="#8a9bb0">${mNames[mNum]}</text>`;
      out += `<text x="${cx}" y="${H-5}" text-anchor="middle" font-size="7" fill="#c2cdd6">${m.slice(2,4)}</text>`;
    });
    // Area fill under p50
    const p50coords = mData.map((d, i) => {
      if (d.p50 === null) return null;
      return [(padL + i*step + step/2).toFixed(1), (padT + chartH - (d.p50/maxVal)*chartH).toFixed(1)];
    }).filter(Boolean);
    if (p50coords.length >= 2) {
      const bottom = (padT+chartH).toFixed(1);
      const polyPts = p50coords.map(([x,y])=>`${x},${y}`).join(" ") +
        ` ${p50coords[p50coords.length-1][0]},${bottom} ${p50coords[0][0]},${bottom}`;
      out += `<polygon points="${polyPts}" fill="rgba(0,207,185,.08)"/>`;
    }
    // Draw line helper
    const drawLine = (getter, color, sw, dash) => {
      const pts = mData.map((d, i) => {
        const v = getter(d);
        if (v === null) return null;
        return `${(padL + i*step + step/2).toFixed(1)},${(padT + chartH - (v/maxVal)*chartH).toFixed(1)}`;
      }).filter(Boolean);
      if (pts.length < 2) return "";
      return `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"${dash?` stroke-dasharray="${dash}"`:""}/>`;
    };
    out += drawLine(d=>d.p90, "#f4c53d", 1.5, "5 3");
    out += drawLine(d=>d.avg, "#00C4E9", 1.5, "");
    out += drawLine(d=>d.p50, "#00CFB9", 2.5, "");
    // Dots + labels for p50
    mData.forEach((d, i) => {
      if (d.p50 === null || !d.n) return;
      const cx = (padL + i*step + step/2).toFixed(1);
      const cy = (padT + chartH - (d.p50/maxVal)*chartH).toFixed(1);
      out += `<circle cx="${cx}" cy="${cy}" r="3" fill="#00CFB9" stroke="#fff" stroke-width="1.5"/>`;
      out += `<text x="${cx}" y="${(parseFloat(cy)-6).toFixed(1)}" text-anchor="middle" font-size="7" font-weight="700" fill="#00CFB9">${fmtHours(d.p50)}</text>`;
    });
    // Invisible hover columns for tooltip
    mData.forEach((d, i) => {
      const cx = padL + i*step;
      const lbl = months[i] || "";
      const ct = d.n
        ? ctEnc(`<b>${esc(lbl)}</b><hr>Mediana p50: <b>${esc(fmtHours(d.p50))}</b><br>Promedio: <b>${esc(fmtHours(d.avg))}</b><br>P90: <b>${esc(fmtHours(d.p90))}</b><hr><span style="color:#8a9bb0">${d.n} consultas cerradas</span>`)
        : ctEnc(`<b>${esc(lbl)}</b><hr><span style="color:#8a9bb0">Sin cierres ese mes</span>`);
      out += `<rect x="${cx.toFixed(1)}" y="${padT}" width="${step.toFixed(1)}" height="${chartH}" fill="transparent" data-ct="${ct}"/>`;
    });
    svg.innerHTML = out;
  }

  function dashRenderTimesHist(resHours) {
    const el = document.getElementById("ttdb-times-hist");
    if (!el) return;
    if (!resHours.length) {
      el.innerHTML = `<div style="color:#8a9bb0;font-size:11px;padding:8px 0">Sin datos de cierre</div>`;
      return;
    }
    const buckets = [
      { lbl:"< 2h",    max:2,        color:"#00CFB9" },
      { lbl:"2–8h",    max:8,        color:"#00C4E9" },
      { lbl:"8h–1d",   max:24,       color:"#30BBE2" },
      { lbl:"1–3d",    max:72,       color:"#7c3aed" },
      { lbl:"3–7d",    max:168,      color:"#a78bfa" },
      { lbl:"7–14d",   max:336,      color:"#f4a53d" },
      { lbl:"14–30d",  max:720,      color:"#e07b39" },
      { lbl:"> 30d",   max:Infinity, color:"#e83e8c" },
    ];
    const counts = buckets.map(() => 0);
    resHours.forEach(h => {
      for (let b = 0; b < buckets.length; b++) {
        if (h < buckets[b].max) { counts[b]++; break; }
      }
    });
    const total = resHours.length, maxC = Math.max(...counts, 1);
    el.innerHTML = buckets.map((b,i) => {
      const ct = ctEnc(`<b>${esc(b.lbl)}</b><hr>${counts[i]} consultas cerradas<br><span class="ct-grn">${pctN(counts[i],total)}%</span> del total`);
      return `<div class="ttdb-thist-row" data-ct="${ct}">
        <div class="ttdb-thist-lbl">${b.lbl}</div>
        <div class="ttdb-thist-bar-wrap"><div class="ttdb-thist-bar-fill" style="width:${Math.round(counts[i]/maxC*100)}%;background:${b.color}"></div></div>
        <div class="ttdb-thist-val">${counts[i]}</div>
        <div class="ttdb-thist-pct">${pctN(counts[i],total)}%</div>
      </div>`;
    }).join("");
  }

  function dashRenderTimesAging(openItems) {
    const el = document.getElementById("ttdb-times-aging");
    if (!el) return;
    if (!openItems.length) {
      el.innerHTML = `<div style="color:#8a9bb0;font-size:11px;padding:8px 0">Sin consultas en curso</div>`;
      return;
    }
    const now = Date.now();
    const buckets = [
      { lbl:"< 1d",    max:24,       color:"#00CFB9" },
      { lbl:"1–3d",    max:72,       color:"#00C4E9" },
      { lbl:"3–7d",    max:168,      color:"#7c3aed" },
      { lbl:"7–14d",   max:336,      color:"#f4a53d" },
      { lbl:"14–30d",  max:720,      color:"#e07b39" },
      { lbl:"30–90d",  max:2160,     color:"#e83e8c" },
      { lbl:"> 90d",   max:Infinity, color:"#991b1b" },
    ];
    const counts = buckets.map(() => 0);
    openItems.forEach(i => {
      if (!i.initDate) return;
      const h = (now - new Date(i.initDate)) / 3600000;
      if (!isFinite(h) || h < 0) return;
      for (let b = 0; b < buckets.length; b++) {
        if (h < buckets[b].max) { counts[b]++; break; }
      }
    });
    const total = openItems.length, maxC = Math.max(...counts, 1);
    el.innerHTML = `<div style="font-size:10px;color:#8a9bb0;margin-bottom:6px"><b style="color:#2c3050">${total}</b> en curso ahora</div>` +
      buckets.map((b,i) => {
        const urgNote = b.color === "#e83e8c" || b.color === "#991b1b" ? " · <span class='ct-red'>Escalación urgente</span>" : b.color === "#e07b39" || b.color === "#f4a53d" ? " · <span class='ct-warn'>Requiere seguimiento</span>" : "";
        const ct = ctEnc(`<b>${esc(b.lbl)}</b>${urgNote}<hr>${counts[i]} consultas en espera<br><span class="ct-grn">${pctN(counts[i],total)}%</span> del backlog activo`);
        return `<div class="ttdb-thist-row" data-ct="${ct}">
          <div class="ttdb-thist-lbl">${b.lbl}</div>
          <div class="ttdb-thist-bar-wrap"><div class="ttdb-thist-bar-fill" style="width:${Math.round(counts[i]/maxC*100)}%;background:${b.color}"></div></div>
          <div class="ttdb-thist-val">${counts[i]}</div>
          <div class="ttdb-thist-pct">${pctN(counts[i],total)}%</div>
        </div>`;
      }).join("");
  }

  function dashRenderTimesByService(items) {
    const el = document.getElementById("ttdb-times-service");
    if (!el) return;
    const svcH = {};
    items.forEach(i => {
      if (!i.endDate || !i.initDate) return;
      const h = (new Date(i.endDate) - new Date(i.initDate)) / 3600000;
      if (!isFinite(h) || h < 0) return;
      const s = i.resolverService || "Sin servicio";
      if (!svcH[s]) svcH[s] = [];
      svcH[s].push(h);
    });
    const rows = Object.entries(svcH)
      .filter(([,hs]) => hs.length >= 2)
      .map(([s,hs]) => ({
        s, n: hs.length,
        p50: percentile(hs, 50),
        avg: hs.reduce((a,b)=>a+b,0)/hs.length,
        p90: percentile(hs, 90),
      }))
      .sort((a,b) => a.p50 - b.p50);
    if (!rows.length) {
      el.innerHTML = `<div style="color:#8a9bb0;font-size:11px;padding:8px 0">Sin datos (mínimo 2 consultas cerradas por servicio)</div>`;
      return;
    }
    const maxP90 = Math.max(...rows.map(r => r.p90), 1);
    const colorFor = h => h < 24 ? "#00CFB9" : h < 120 ? "#00C4E9" : h < 360 ? "#f4a53d" : "#e83e8c";
    el.innerHTML = rows.map(r => {
      const p50w = Math.round(r.p50/maxP90*100);
      const avgw = Math.round(r.avg/maxP90*100);
      const p90w = Math.round(r.p90/maxP90*100);
      const c    = colorFor(r.p50);
      const skew = r.avg / r.p50;
      const skewNote = skew > 1.8 ? `<br><span class="ct-warn">Media muy alta — hay casos extremos</span>` : skew > 1.3 ? `<br><span class="ct-warn">Cola larga detectada</span>` : "";
      const ct = ctEnc(
        `<b>${esc(r.s)}</b><hr>` +
        `Mediana (p50): <b>${esc(fmtHours(r.p50))}</b><br>` +
        `Promedio: <b>${esc(fmtHours(r.avg))}</b><br>` +
        `P90: <b>${esc(fmtHours(r.p90))}</b>${skewNote}<hr>` +
        `<span style="color:#8a9bb0">${r.n} consultas cerradas</span>`
      );
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:10px" data-ct="${ct}">
        <div style="flex:0 0 150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#2c3050" title="${esc(r.s)}">${esc(r.s)}</div>
        <div style="flex:1;position:relative;height:14px;min-width:60px">
          <div style="position:absolute;inset:3px 0;background:#edf0f3;border-radius:4px;width:${p90w}%"></div>
          <div style="position:absolute;inset:3px 0;background:rgba(0,196,233,.35);border-radius:4px;width:${avgw}%"></div>
          <div style="position:absolute;inset:3px 0;background:${c};border-radius:4px;width:${p50w}%"></div>
        </div>
        <div style="flex:0 0 38px;text-align:right;font-weight:700;color:${c}">${fmtHours(r.p50)}</div>
        <div style="flex:0 0 54px;text-align:right;font-size:9px;color:#8a9bb0">p90:${fmtHours(r.p90)}</div>
        <div style="flex:0 0 22px;text-align:right;font-size:9px;color:#c2cdd6">${r.n}×</div>
      </div>`;
    }).join("") +
    `<div style="font-size:9px;color:#c2cdd6;margin-top:6px">■ p50 &nbsp; ░ promedio &nbsp; □ p90 &nbsp;·&nbsp; Ordenado de más rápido (arriba) a más lento · pasa el ratón para ver detalle</div>`;
  }

  function dashRenderTimesByComplexity(items) {
    const el = document.getElementById("ttdb-times-cplx");
    if (!el) return;
    const lvls = [
      { key:"LOW",    label:"Baja",  color:"#00CFB9" },
      { key:"MEDIUM", label:"Media", color:"#f4c53d" },
      { key:"HIGH",   label:"Alta",  color:"#e83e8c" },
    ];
    const byLvl = {};
    lvls.forEach(l => { byLvl[l.key] = []; });
    items.forEach(i => {
      if (!i.endDate || !i.initDate || !i.complexity) return;
      const h = (new Date(i.endDate) - new Date(i.initDate)) / 3600000;
      if (!isFinite(h) || h < 0) return;
      if (byLvl[i.complexity]) byLvl[i.complexity].push(h);
    });
    const hasData = lvls.some(l => byLvl[l.key].length > 0);
    if (!hasData) {
      el.innerHTML = `<div style="color:#8a9bb0;font-size:11px;padding:8px 0">Sin datos de complejidad (solo disponible en consultas cerradas)</div>`;
      return;
    }
    const globalMax = Math.max(...Object.values(byLvl).flatMap(x=>x), 1);
    el.innerHTML = lvls.map(({key,label,color}) => {
      const hs = byLvl[key];
      if (!hs.length) return `<div style="margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;color:${color};margin-bottom:4px">${label} <span style="font-weight:400;color:#8a9bb0">(0)</span></div>
        <div style="color:#c2cdd6;font-size:9px;font-style:italic">Sin datos</div>
      </div>`;
      const p50 = percentile(hs, 50);
      const avg = hs.reduce((a,b)=>a+b,0)/hs.length;
      const p90 = percentile(hs, 90);
      const ct = ctEnc(`<b style="color:${color}">${esc(label)}</b> · ${hs.length} consultas<hr>Mediana (p50): <b>${esc(fmtHours(p50))}</b><br>Promedio: <b>${esc(fmtHours(avg))}</b><br>P90: <b>${esc(fmtHours(p90))}</b>`);
      return `<div style="margin-bottom:14px" data-ct="${ct}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
          <div style="font-size:10px;font-weight:700;color:${color}">${label} <span style="font-weight:400;color:#8a9bb0">(${hs.length})</span></div>
          <div style="display:flex;gap:10px;font-size:9px;color:#8a9bb0">
            <span>p50 <b style="color:#2c3050">${fmtHours(p50)}</b></span>
            <span>avg <b style="color:#2c3050">${fmtHours(avg)}</b></span>
            <span>p90 <b style="color:#2c3050">${fmtHours(p90)}</b></span>
          </div>
        </div>
        <div style="position:relative;height:10px;background:#edf0f3;border-radius:5px;overflow:hidden">
          <div style="position:absolute;left:0;top:0;width:${Math.round(p90/globalMax*100)}%;height:100%;background:${color};opacity:.12"></div>
          <div style="position:absolute;left:0;top:0;width:${Math.round(avg/globalMax*100)}%;height:100%;background:${color};opacity:.4"></div>
          <div style="position:absolute;left:0;top:0;width:${Math.round(p50/globalMax*100)}%;height:100%;background:${color};border-radius:5px"></div>
        </div>
      </div>`;
    }).join("");
  }

  function dashRenderTimesByWeekday(closed) {
    const el = document.getElementById("ttdb-times-weekday");
    if (!el) return;
    const DAY = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
    const byDay = Array.from({length:7}, ()=>[]);
    closed.forEach(i => {
      if (!i.initDate || !i.endDate) return;
      const h = (new Date(i.endDate) - new Date(i.initDate)) / 3600000;
      if (!isFinite(h) || h < 0) return;
      byDay[new Date(i.initDate).getDay()].push(h);
    });
    const avgs = byDay.map(hs => hs.length >= 2 ? hs.reduce((a,b)=>a+b,0)/hs.length : null);
    const maxA = Math.max(...avgs.filter(x=>x!==null), 1);
    if (!avgs.some(x=>x!==null)) {
      el.innerHTML = `<div style="color:#8a9bb0;font-size:11px;padding:8px 0">Sin datos</div>`;
      return;
    }
    const H=90, padT=10, padB=22, padL=6, padR=6, chartH=H-padT-padB;
    const W = 240;
    const step=(W-padL-padR)/7, barW=Math.max(step-4,8);
    const colorFor = h => h===null?"#edf0f3":h<24?"#00CFB9":h<120?"#00C4E9":h<360?"#f4a53d":"#e83e8c";
    let out = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;display:block">`;
    DAY.forEach((name, d) => {
      const v   = avgs[d];
      const n   = byDay[d].length;
      const x   = padL + d*step + (step-barW)/2;
      const bH  = v !== null ? (v/maxA)*chartH : 0;
      const isWknd = d===0||d===6;
      const col = colorFor(v);
      const ct  = v !== null
        ? ctEnc(`<b>${esc(name)}</b>${isWknd?" · fin de semana":""}<hr>T. medio: <b>${esc(fmtHours(v))}</b><br>${n} consultas`)
        : ctEnc(`<b>${esc(name)}</b><hr><span style="color:#8a9bb0">Sin datos suficientes (mín. 2)</span>`);
      if (bH>0) out += `<rect x="${x.toFixed(1)}" y="${(padT+chartH-bH).toFixed(1)}" width="${barW.toFixed(1)}" height="${bH.toFixed(1)}" fill="${col}" rx="2" opacity="${isWknd?0.55:1}" data-ct="${ct}"/>`;
      else       out += `<rect x="${x.toFixed(1)}" y="${(padT+chartH-2).toFixed(1)}" width="${barW.toFixed(1)}" height="${chartH}" fill="transparent" rx="1" data-ct="${ct}"/>`;
      out += `<text x="${(x+barW/2).toFixed(1)}" y="${H-7}" text-anchor="middle" font-size="8" fill="${isWknd?"#c2cdd6":"#8a9bb0"}">${name}</text>`;
      if (v !== null) out += `<text x="${(x+barW/2).toFixed(1)}" y="${(padT+chartH-bH-3).toFixed(1)}" text-anchor="middle" font-size="7" fill="${col}">${fmtHours(v)}</text>`;
    });
    out += `</svg><div style="font-size:9px;color:#c2cdd6;margin-top:3px">T. medio de resolución según día de apertura · mín. 2 datos por día</div>`;
    el.innerHTML = out;
  }

  function dashRenderTimesBottleneck(items) {
    const el = document.getElementById("ttdb-times-bottleneck");
    if (!el) return;
    const now = Date.now();
    const THRESH_H = 168;
    const slowClosed = items.filter(i => i.endDate && i.initDate &&
      (new Date(i.endDate) - new Date(i.initDate)) / 3600000 > THRESH_H);
    const slowOpen = items.filter(i => !i.endDate && i.initDate &&
      (now - new Date(i.initDate)) / 3600000 > THRESH_H);
    const slow = [...slowClosed, ...slowOpen];
    if (!slow.length) {
      el.innerHTML = `<div style="text-align:center;padding:14px;color:#00CFB9;font-size:12px">✓ Ninguna consulta supera los 7 días en el periodo seleccionado</div>`;
      return;
    }
    const totalSlow = slow.length;
    // By service
    const bySvc = {};
    slow.forEach(i => { const s = i.resolverService||"Sin servicio"; bySvc[s]=(bySvc[s]||0)+1; });
    const topSvc = Object.entries(bySvc).sort((a,b)=>b[1]-a[1]).slice(0,6);
    // By complexity
    const byCplx = {};
    slow.forEach(i => { const k = i.complexity||"Sin datos"; byCplx[k]=(byCplx[k]||0)+1; });
    const cplxOrder = [["LOW","Baja","#00CFB9"],["MEDIUM","Media","#f4a53d"],["HIGH","Alta","#e83e8c"],["Sin datos","Sin datos","#c2cdd6"]];
    // By PPM
    const byPPM = {};
    slow.forEach(i => { const p = i.ppm||"Sin PPM"; byPPM[p]=(byPPM[p]||0)+1; });
    const topPPM = Object.entries(byPPM).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const svcCols = ["#e83e8c","#f4a53d","#7c3aed","#00C4E9","#00CFB9","#c2cdd6"];
    el.innerHTML = `
      <div style="font-size:10px;color:#8a9bb0;margin-bottom:12px">
        <b style="color:#e83e8c;font-size:14px">${totalSlow}</b> consultas con más de 7 días &nbsp;·&nbsp;
        ${slowClosed.length} cerradas lentamente &nbsp;·&nbsp;
        <b style="color:#e83e8c">${slowOpen.length}</b> aún abiertas
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px">
        <div>
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8a9bb0;margin-bottom:8px">Por servicio</div>
          ${topSvc.map(([s,c],i)=>`
            <div class="ttdb-type-row">
              <div class="ttdb-type-name" title="${s}">${s}</div>
              <div class="ttdb-type-bar-wrap" style="width:70px"><div class="ttdb-type-bar-fill" style="width:${Math.round(c/topSvc[0][1]*100)}%;background:${svcCols[i%svcCols.length]}"></div></div>
              <div class="ttdb-type-count">${c}</div>
              <div style="width:28px;text-align:right;font-size:9px;color:#8a9bb0">${Math.round(c/totalSlow*100)}%</div>
            </div>`).join("")}
        </div>
        <div>
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8a9bb0;margin-bottom:8px">Por complejidad</div>
          ${cplxOrder.filter(([k])=>byCplx[k]).map(([k,label,color])=>{const c=byCplx[k]||0;return`
            <div class="ttdb-type-row">
              <div class="ttdb-type-name" style="min-width:70px;max-width:70px">${label}</div>
              <div class="ttdb-type-bar-wrap" style="width:70px"><div class="ttdb-type-bar-fill" style="width:${Math.round(c/totalSlow*100)}%;background:${color}"></div></div>
              <div class="ttdb-type-count">${c}</div>
              <div style="width:28px;text-align:right;font-size:9px;color:#8a9bb0">${Math.round(c/totalSlow*100)}%</div>
            </div>`;}).join("")}
        </div>
        <div>
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8a9bb0;margin-bottom:8px">Por PPM</div>
          ${topPPM.map(([p,c])=>`
            <div class="ttdb-type-row">
              <div class="ttdb-type-name" style="min-width:70px;max-width:70px">${p}</div>
              <div class="ttdb-type-bar-wrap" style="width:70px"><div class="ttdb-type-bar-fill" style="width:${Math.round(c/topPPM[0][1]*100)}%;background:#7c3aed"></div></div>
              <div class="ttdb-type-count">${c}</div>
              <div style="width:28px;text-align:right;font-size:9px;color:#8a9bb0">${Math.round(c/totalSlow*100)}%</div>
            </div>`).join("")}
        </div>
      </div>
    `;
  }

  // ── Network / API Explorer ─────────────────────────────────────────
  function renderNetExplorer() {
    const el = document.getElementById("ttdb-net-list");
    const cntEl = document.getElementById("ttdb-net-count");
    if (!el) return;
    const filter = state.dash.netFilter || "all";

    // Merge live captures with KNOWN_ENDPOINTS catalog
    // Live data takes precedence; known-only endpoints get a "📚 histórico" badge
    const liveMap = {};
    for (const p of Object.values(state.byPattern)) {
      liveMap[p.method + "|" + p.pattern] = p;
    }
    const knownMap = {};
    for (const k of KNOWN_ENDPOINTS) {
      knownMap[k.method + "|" + k.pattern] = k;
    }
    // Build combined list
    const allKeys = new Set([...Object.keys(liveMap), ...Object.keys(knownMap)]);
    let patterns = [];
    for (const key of allKeys) {
      const live = liveMap[key];
      const known = knownMap[key];
      if (live) {
        // Enrich live entry with known responseFields if live has no body yet
        patterns.push({ ...live, _knownFields: known?.responseFields || [], _historic: false });
      } else {
        // known-only: use historical data, mark as historic
        patterns.push({
          pattern: known.pattern,
          method: known.method,
          count: known.count,
          errors: Object.entries(known.statusCodes).filter(([s])=>s[0]!=="2").reduce((a,[,c])=>a+c,0),
          totalMs: 0,
          statusCodes: known.statusCodes,
          queryParamKeys: known.queryParamKeys,
          examples: [],
          _knownFields: known.responseFields || [],
          _historic: true,
        });
      }
    }

    // Apply filters
    if (filter === "api")    patterns = patterns.filter(p => p.pattern.includes("api.pro.internal") || p.pattern.includes("api.pro.caixabank"));
    if (filter === "errors") patterns = patterns.filter(p => p.errors > 0);
    patterns.sort((a,b) => {
      // live entries first, then sort by count desc
      if (!a._historic && b._historic) return -1;
      if (a._historic && !b._historic) return 1;
      return b.count - a.count;
    });

    const liveCount = patterns.filter(p=>!p._historic).length;
    const histCount = patterns.filter(p=>p._historic).length;
    if (cntEl) cntEl.textContent = `${patterns.length} endpoints · ${liveCount} live · ${histCount} histórico · ${state.network.length} llamadas`;

    if (!patterns.length) {
      el.innerHTML = `<div style="text-align:center;padding:40px;color:#8a9bb0;font-size:12px">Sin endpoints. Navega por el portal para capturarlos.</div>`;
      return;
    }

    const mColor = m => m==="GET"?"ttdb-net-m-get":m==="POST"?"ttdb-net-m-post":"ttdb-sc-e";
    el.innerHTML = patterns.map((p, idx) => {
      const avgMs = (!p._historic && p.count) ? Math.round(p.totalMs/p.count) : 0;
      const errPct = p.count ? Math.round(p.errors/p.count*100) : 0;
      const scBadges = Object.entries(p.statusCodes).map(([s,c]) => {
        const cls = s[0]==="2"?"ttdb-sc-2":s[0]==="4"?"ttdb-sc-4":s[0]==="5"?"ttdb-sc-5":"ttdb-sc-e";
        return `<span class="ttdb-sc-pill ${cls}">${s} ×${c}</span>`;
      }).join("");

      // best example: last one with resBody
      const ex = p.examples?.length ? ([...p.examples].reverse().find(e=>e.resBody) || p.examples[p.examples.length-1]) : null;
      const body = ex?.resBody;

      // response field pills — prefer live body keys, fall back to known fields catalog
      let fieldHtml = "";
      if (body && typeof body === "object") {
        const keys = body.content ? Object.keys(body.content[0]||{}) : Object.keys(body);
        fieldHtml = keys.slice(0,12).map(k => {
          const v = body.content ? body.content[0]?.[k] : body[k];
          const preview = v===null?"null":Array.isArray(v)?`[${v.length}]`:typeof v==="object"&&v?`{…}`:(String(v)).slice(0,18);
          return `<span class="ttdb-fld">${k}: <b>${preview}</b></span>`;
        }).join("");
        if (body.content) fieldHtml = `<span class="ttdb-fld">total: <b>${body.totalElements}</b></span> <span class="ttdb-fld">pages: <b>${body.totalPages}</b></span> ` + fieldHtml;
      } else if (p._knownFields?.length) {
        fieldHtml = p._knownFields.map(k => `<span class="ttdb-fld">${k}</span>`).join("");
      }

      const qpKeys = p.queryParamKeys instanceof Set ? [...p.queryParamKeys] : (p.queryParamKeys||[]);
      const sample = body ? JSON.stringify(body,null,2).slice(0,1200)+(JSON.stringify(body).length>1200?"\n…":"") : (p._historic ? "(sin captura en sesión actual)" : "(sin body)");
      const urlShort = p.pattern
        .replace("https://api.pro.internal.caixabank.com","[API]")
        .replace("https://apicollector.pro.internal.caixabank.com","[COLLECTOR]")
        .replace(/https?:\/\/[^/]+/,"[PORTAL]");
      const badge = p._historic
        ? `<span style="font-size:9px;padding:1px 5px;border-radius:8px;background:#f0f4ff;color:#7c3aed;border:1px solid #c4b5fd;flex-shrink:0">📚 histórico</span>`
        : `<span class="ttdb-net-cnt">${p.count} call${p.count!==1?"s":""}</span>`;
      return `<div class="ttdb-net-row" id="ttdb-nr-${idx}">
        <div class="ttdb-net-head" onclick="window.__teamerToolkit._dashNetExpand(${idx})">
          <span class="ttdb-net-method ${mColor(p.method)}">${p.method}</span>
          <span class="ttdb-net-url" title="${p.pattern}">${urlShort}</span>
          ${badge}
          ${!p._historic && avgMs ? `<span class="ttdb-net-ms">${avgMs}ms</span>` : ""}
          ${p.errors?`<span class="ttdb-net-err">⚠ ${errPct}% err</span>`:""}
          <span class="ttdb-net-chev">▶</span>
        </div>
        <div class="ttdb-net-body">
          <div class="ttdb-net-sc">${scBadges}</div>
          ${qpKeys.length?`<div><span class="ttdb-net-section">Query params</span><div class="ttdb-net-fields">${qpKeys.map(k=>`<span class="ttdb-fld">${k}</span>`).join("")}</div></div>`:""}
          ${fieldHtml?`<div><span class="ttdb-net-section">Campos response</span><div class="ttdb-net-fields">${fieldHtml}</div></div>`:""}
          <div><span class="ttdb-net-section">${p._historic?"Response (histórico)":"Último response"}</span><pre class="ttdb-net-pre">${String(sample).replace(/</g,"&lt;")}</pre></div>
        </div>
      </div>`;
    }).join("");
  }

  // ── Public dashboard controls ──────────────────────────────────────
  window.__teamerToolkit._dashClose      = closeDashboard;
  window.__teamerToolkit._dashDemo       = () => {
    loadDashDemo();
    // also demo for consultas if on that tab
    loadConsultasDemo();
  };
  window.__teamerToolkit._dashCancel     = () => { state.dash.cancel = true; state.dash.cons.cancel = true; };

  window.__teamerToolkit._dashNav = (tab, el) => {
    document.querySelectorAll(".ttdb-ntab").forEach(t => t.classList.remove("active"));
    el.classList.add("active");
    const main   = document.getElementById("ttdb-main");
    const cmain  = document.getElementById("ttdb-cons-main");
    const tmain  = document.getElementById("ttdb-times-main");
    const nmain  = document.getElementById("ttdb-net-main");
    const svcHdr = document.getElementById("ttdb-hdr-svc");
    [main,cmain,tmain,nmain].forEach(e => { if(e) e.style.display="none"; });
    if (svcHdr) svcHdr.style.display = (tab === "cons" || tab === "times") ? "flex" : "none";
    if (tab === "vol") {
      if (main) main.style.display = "";
      // Surface any background error from the processes loader
      if (state.dash.volError) {
        dashShowErr("Error procesos: " + state.dash.volError + " — comprueba el token.");
        state.dash.volError = null;
      }
    } else if (tab === "cons") {
      if (state.dash.cons.loaded) {
        // Already loaded (parallel load finished) — render immediately
        if (cmain) cmain.style.display = "flex";
        renderConsultas();
      } else {
        // Still loading in background — show loading spinner; render fires when done
        dashSetLoading(true, "Cargando consultas…", 0);
      }
      // Surface any background error from the consultas loader
      if (state.dash.cons.error) {
        dashShowErr("Error consultas: " + state.dash.cons.error);
        state.dash.cons.error = null;
      }
    } else if (tab === "times") {
      if (state.dash.cons.loaded) {
        renderTiempos();  // sets display:flex internally
      } else {
        dashSetLoading(true, "Cargando datos de tiempos…", 0);
      }
      if (state.dash.cons.error) {
        dashShowErr("Error consultas: " + state.dash.cons.error);
        state.dash.cons.error = null;
      }
    } else if (tab === "net") {
      if (nmain) nmain.style.display = "flex";
      renderNetExplorer();
    }
  };

  window.__teamerToolkit._dashNetFilter = (f, el) => {
    el.closest(".ttdb-tabs").querySelectorAll(".ttdb-tab").forEach(t=>t.classList.remove("active"));
    el.classList.add("active");
    state.dash.netFilter = f;
    renderNetExplorer();
  };
  window.__teamerToolkit._dashNetExpand = (idx) => {
    const row = document.getElementById("ttdb-nr-"+idx);
    if (row) row.classList.toggle("open");
  };
  window.__teamerToolkit._dashNetRefresh = () => renderNetExplorer();

  window.__teamerToolkit._dashSvcFilter = (svc) => {
    state.dash.cons.serviceFilter = svc;
    const tmain = document.getElementById("ttdb-times-main");
    if (tmain && tmain.style.display !== "none") {
      renderTiempos();
    } else {
      renderConsultas();
      setTimeout(() => {
        const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear()-1);
        const f = state.dash.cons.items.filter(i =>
          new Date(i.initDate) >= cutoff && (svc==="all" || i.resolverService===svc)
        );
        dashRenderConsultasBar(f, dashBuildMonths(state.dash.cons.windowM));
      }, 50);
    }
  };

  window.__teamerToolkit._dashSvcFilterClick = (svc) => {
    const cur = state.dash.cons.serviceFilter;
    const next = cur === svc ? "all" : svc;
    const sel = document.getElementById("ttdb-svc-select");
    if (sel) sel.value = next;
    window.__teamerToolkit._dashSvcFilter(next);
  };

  window.__teamerToolkit._dashConsWindow = (n, el) => {
    el.closest(".ttdb-tabs").querySelectorAll(".ttdb-tab").forEach(t => t.classList.remove("active"));
    el.classList.add("active");
    state.dash.cons.windowM = n;
    const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear()-1);
    const svc = state.dash.cons.serviceFilter;
    const f = state.dash.cons.items.filter(i =>
      new Date(i.initDate) >= cutoff && (svc==="all" || i.resolverService===svc)
    );
    const months = dashBuildMonths(n);
    dashRenderOpenClose(f, months);
    dashRenderConsultasBar(f, months);
    dashRenderFeedbackTrend(f, months);
  };
  window.__teamerToolkit._dashTimesWindow = (n, el) => {
    el.closest(".ttdb-tabs").querySelectorAll(".ttdb-tab").forEach(t => t.classList.remove("active"));
    el.classList.add("active");
    state.dash.timesWindowM = n;
    renderTiempos();
  };
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
    // Panel entrance + button pulse keyframes (scoped to avoid conflicts)
    if (!document.getElementById("tt-panel-style")) {
      const ps = document.createElement("style");
      ps.id = "tt-panel-style";
      ps.textContent = `
        @keyframes tt-panel-in{
          0%  { opacity:0; transform:translateY(36px) scale(.86); }
          72% { transform:translateY(-7px) scale(1.03); }
          100%{ opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes tt-btn-glow{
          0%,100%{ box-shadow:0 0 0 0 rgba(124,58,237,.7); }
          50%    { box-shadow:0 0 0 8px rgba(124,58,237,0); }
        }
        @keyframes tt-btn-shimmer{
          from{ background-position:-200% 0; }
          to  { background-position:200% 0; }
        }
      `;
      document.head.appendChild(ps);
    }

    const panel = document.createElement("div");
    panel.id = "tt-panel";
    panel.style.cssText = [
      "position:fixed","bottom:10px","right:10px","width:380px","max-height:65vh",
      "background:#1f1f1f","color:#fff","padding:10px","border-radius:10px",
      "z-index:999999","font:12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial",
      "box-shadow:0 8px 30px rgba(0,0,0,.35)",
      "animation:tt-panel-in .5s cubic-bezier(.22,.68,0,1.15) both"
    ].join(";");

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div><b>Teamer Toolkit</b> <span style="opacity:.5;font-size:10px">v5 · 2026-05-20 21:55</span></div>
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
        <button id="tt-dashboard-btn" style="cursor:pointer;border:0;border-radius:8px;padding:6px;font-size:10px;background:linear-gradient(90deg,#7c3aed,#00C4E9,#7c3aed);background-size:200% 100%;color:#fff;font-weight:700;animation:tt-btn-glow .9s .6s 3 ease-out,tt-btn-shimmer 2s .3s 2 ease-in-out both">📊 Vol.</button>
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
  setOutput("✅ Listo (v5).\n- Network logger activo (bodies + headers).\n- Pulsa '📊 Vol.' → pestaña Volumetría o 💬 Consultas.\n- Pulsa '⬇ Export' para descargar los 2 JSON al terminar.");

})();
