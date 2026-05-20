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
    debug: true,
    maxNetworkLog: 5000,
    maxBodyBytes:  512_000,
    apiTimeoutMs: 10000,
    skipExtensions: /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map|webp|avif)(\?|$)/i,
  };

  const state = {
    observer: null,
    network: [],            // log completo con bodies
    byPattern: {},          // agrupado por endpoint normalizado
    startedAt: new Date().toISOString(),
    origFetch: window.fetch ? window.fetch.bind(window) : null,
    origXHROpen: XMLHttpRequest.prototype.open,
    origXHRSend: XMLHttpRequest.prototype.send,
    origXHRSetRH: XMLHttpRequest.prototype.setRequestHeader,
    ui: { panel: null, output: null, endpointInput: null }
  };

  function log(...args) {
    if (CONFIG.debug) console.log("[TeamerToolkit]", ...args);
  }

  // ==== Highlight ====
  function getUserElement() {
    return document.querySelector(CONFIG.selector);
  }

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
  function nowIso() {
    return new Date().toISOString();
  }

  function safeText(x) {
    try { return typeof x === "string" ? x : JSON.stringify(x, null, 2); }
    catch { return String(x); }
  }

  function setOutput(text) {
    if (state.ui.output) {
      state.ui.output.textContent = text;
    } else {
      console.log(text);
    }
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      alert("✅ Copiado al portapapeles");
    } catch (e) {
      alert("❌ No se pudo copiar (permiso/entorno). Mira consola.");
      console.error(e);
    }
  }

  function truncateBody(str) {
    if (!str || str.length <= CONFIG.maxBodyBytes) return str;
    return str.slice(0, CONFIG.maxBodyBytes) + `\n…[TRUNCADO: ${str.length - CONFIG.maxBodyBytes} bytes omitidos]`;
  }

  function tryParseJson(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return str; }
  }

  function shouldSkip(url) {
    return CONFIG.skipExtensions.test(url);
  }

  function normalizePattern(rawUrl) {
    try {
      const u = new URL(rawUrl, location.origin);
      const path = u.pathname
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/{uuid}")
        .replace(/\/\d{5,}/g, "/{id}")
        .replace(/\/[A-Z]{2,}-?\d{3,}/g, "/{ref}");
      return u.origin + path;
    } catch {
      return rawUrl;
    }
  }

  function extractQueryParams(rawUrl) {
    try {
      const params = {};
      new URL(rawUrl, location.origin).searchParams.forEach((v, k) => { params[k] = v; });
      return params;
    } catch { return {}; }
  }

  // ==== Store a network entry (full: with bodies) ====
  function pushNetwork(entry) {
    if (shouldSkip(entry.url)) return;

    // normalize pattern for grouping
    const pattern = normalizePattern(entry.url);
    entry.pattern = pattern;

    // flat log (capped)
    if (state.network.length >= CONFIG.maxNetworkLog) state.network.shift();
    state.network.unshift(entry);

    // grouped by pattern
    if (!state.byPattern[pattern]) {
      state.byPattern[pattern] = {
        pattern,
        method: entry.method,
        count: 0,
        errors: 0,
        totalMs: 0,
        statusCodes: {},
        queryParamKeys: new Set(),
        examples: [],
      };
    }
    const ep = state.byPattern[pattern];
    ep.count++;
    ep.totalMs += entry.ms || 0;
    const sc = entry.status || 0;
    ep.statusCodes[sc] = (ep.statusCodes[sc] || 0) + 1;
    if (sc >= 400 || sc === "ERR") ep.errors++;
    Object.keys(extractQueryParams(entry.url)).forEach(k => ep.queryParamKeys.add(k));
    ep.examples.push(entry);

    renderNetwork();
  }

  // ==== Network intercept (fetch + XHR) ====
  function installNetworkHooks() {
    // ── Hook fetch ──────────────────────────────────────────────────────
    if (state.origFetch) {
      window.fetch = async function (input, init = {}) {
        const start = performance.now();
        const method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
        const url = typeof input === "string" ? input : (input && input.url) ? input.url : String(input);

        // request headers
        const reqHeaders = {};
        try {
          const h = (init && init.headers) || (input && input.headers);
          if (h instanceof Headers) h.forEach((v, k) => { reqHeaders[k] = v; });
          else if (h) Object.assign(reqHeaders, h);
        } catch {}

        // request body
        let reqBody = null;
        if (init && init.body) {
          try { reqBody = typeof init.body === "string" ? tryParseJson(init.body) : "[non-string body]"; }
          catch { reqBody = "[parse error]"; }
        }

        let res;
        try {
          res = await state.origFetch(input, init);
        } catch (err) {
          pushNetwork({
            ts: nowIso(), type: "fetch", method, url,
            status: "ERR", ms: Math.round(performance.now() - start),
            reqHeaders, reqBody,
            resHeaders: {}, resBody: String(err), error: String(err),
          });
          throw err;
        }

        const ms = Math.round(performance.now() - start);
        const resHeaders = {};
        res.headers.forEach((v, k) => { resHeaders[k] = v; });

        // read body without consuming the original response
        res.clone().text().then(text => {
          pushNetwork({
            ts: nowIso(), type: "fetch", method, url,
            status: res.status, ms,
            reqHeaders, reqBody,
            resHeaders,
            resBody: tryParseJson(truncateBody(text)),
            queryParams: extractQueryParams(url),
          });
        }).catch(() => {
          pushNetwork({
            ts: nowIso(), type: "fetch", method, url,
            status: res.status, ms,
            reqHeaders, reqBody,
            resHeaders, resBody: null,
            queryParams: extractQueryParams(url),
          });
        });

        return res;
      };
    }

    // ── Hook XHR ────────────────────────────────────────────────────────
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__tt = { method: (method || "GET").toUpperCase(), url: String(url), start: 0, reqHeaders: {} };
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
          try {
            this.getAllResponseHeaders().split("\r\n").filter(Boolean).forEach(line => {
              const i = line.indexOf(": ");
              if (i > -1) resHeaders[line.slice(0, i).toLowerCase()] = line.slice(i + 2);
            });
          } catch {}
          pushNetwork({
            ts: nowIso(), type: "xhr",
            method: this.__tt.method,
            url: this.__tt.url,
            status: this.status,
            ms,
            reqHeaders: this.__tt.reqHeaders || {},
            reqBody:    this.__tt.reqBody    || null,
            resHeaders,
            resBody: tryParseJson(truncateBody(this.responseText)),
            queryParams: extractQueryParams(this.__tt.url),
          });
        });
      }
      return state.origXHRSend.apply(this, arguments);
    };

    log("✅ Network hooks instalados (fetch + XHR + bodies + headers)");
  }

  function uninstallNetworkHooks() {
    if (state.origFetch) window.fetch = state.origFetch;
    XMLHttpRequest.prototype.open = state.origXHROpen;
    XMLHttpRequest.prototype.send = state.origXHRSend;
    XMLHttpRequest.prototype.setRequestHeader = state.origXHRSetRH;
    log("🧹 Network hooks restaurados");
  }

  // ==== API caller (same-origin) ====
  async function apiCall(pathOrUrl) {
    const url = normalizeUrl(pathOrUrl);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), CONFIG.apiTimeoutMs);

    const start = performance.now();
    try {
      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: { "Accept": "application/json, text/plain, */*" },
        signal: controller.signal
      });

      const ms = Math.round(performance.now() - start);
      const contentType = res.headers.get("content-type") || "";
      let body;
      if (contentType.includes("application/json")) {
        body = await res.json();
      } else {
        body = await res.text();
      }

      setOutput(
        `GET ${url}\nStatus: ${res.status}\nContent-Type: ${contentType}\n\n` +
        safeText(body)
      );
    } catch (e) {
      setOutput(`❌ Error llamando ${url}\n${String(e)}`);
    } finally {
      clearTimeout(t);
    }
  }

  function normalizeUrl(pathOrUrl) {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    const base = window.location.origin;
    const p = pathOrUrl.startsWith("/") ? pathOrUrl : ("/" + pathOrUrl);
    return base + p;
  }

  // ==== Export builders ====
  function tsStamp() {
    return new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  }

  function saveFile(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function describeShape(val, depth) {
    if (depth > 4) return "…";
    if (val === null) return "null";
    if (Array.isArray(val)) return val.length ? [describeShape(val[0], depth + 1)] : [];
    if (typeof val === "object") {
      const out = {};
      Object.keys(val).slice(0, 40).forEach(k => { out[k] = describeShape(val[k], depth + 1); });
      return out;
    }
    return typeof val;
  }

  function inferSchema(examples) {
    const sample = examples.find(e => e.status >= 200 && e.status < 300 && e.resBody && typeof e.resBody === "object");
    return sample ? describeShape(sample.resBody, 0) : null;
  }

  function buildAnalysis() {
    const endpoints = Object.values(state.byPattern).map(ep => ({
      pattern:        ep.pattern,
      method:         ep.method,
      count:          ep.count,
      errors:         ep.errors,
      avgMs:          ep.count ? Math.round(ep.totalMs / ep.count) : 0,
      statusCodes:    ep.statusCodes,
      queryParamKeys: [...ep.queryParamKeys],
      responseSchema: inferSchema(ep.examples),
      examples: ep.examples
        .filter(e => e.status >= 200 && e.status < 300)
        .slice(0, 5),
    }));
    endpoints.sort((a, b) => b.count - a.count);
    return {
      meta: {
        capturedAt:  new Date().toISOString(),
        startedAt:   state.startedAt,
        pageOrigin:  location.origin,
        pageTitle:   document.title,
        totalCalls:  state.network.length,
        endpoints:   endpoints.length,
      },
      endpoints,
    };
  }

  function buildRaw() {
    return {
      meta: {
        capturedAt: new Date().toISOString(),
        startedAt:  state.startedAt,
        pageOrigin: location.origin,
        pageTitle:  document.title,
        totalCalls: state.network.length,
      },
      calls: [...state.network].reverse().map(c => ({
        ts:          c.ts,
        type:        c.type,
        method:      c.method,
        url:         c.url,
        pattern:     c.pattern,
        status:      c.status,
        ms:          c.ms,
        queryParams: c.queryParams  || {},
        reqHeaders:  c.reqHeaders   || {},
        reqBody:     c.reqBody      || null,
        resHeaders:  c.resHeaders   || {},
        resBody:     c.resBody      || null,
      })),
    };
  }

  function doExport() {
    const stamp    = tsStamp();
    const analysis = buildAnalysis();
    const raw      = buildRaw();
    saveFile(analysis, `tt-analysis-${stamp}.json`);
    setTimeout(() => saveFile(raw, `tt-raw-${stamp}.json`), 400);
    setOutput(
      `✅ Exportados 2 archivos:\n` +
      `  tt-analysis-${stamp}.json  (${analysis.meta.endpoints} endpoints)\n` +
      `  tt-raw-${stamp}.json       (${raw.meta.totalCalls} llamadas con bodies completos)`
    );
    log("Export completado:", analysis.meta);
  }

  // ==== UI ====
  function createPanel() {
    const panel = document.createElement("div");
    panel.id = "tt-panel";
    panel.style.cssText = [
      "position:fixed",
      "bottom:10px",
      "right:10px",
      "width:380px",
      "max-height:65vh",
      "background:#1f1f1f",
      "color:#fff",
      "padding:10px",
      "border-radius:10px",
      "z-index:999999",
      "font:12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial",
      "box-shadow:0 8px 30px rgba(0,0,0,.35)"
    ].join(";");

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div><b>Teamer Toolkit</b> <span style="opacity:.5;font-size:10px">v3 · capturing bodies</span></div>
        <div style="display:flex;gap:6px;">
          <button id="tt-min" style="cursor:pointer;border:0;border-radius:6px;padding:4px 8px;">_</button>
          <button id="tt-close" style="cursor:pointer;border:0;border-radius:6px;padding:4px 8px;">X</button>
        </div>
      </div>

      <div id="tt-stats" style="font-size:10px;opacity:.7;margin-bottom:8px;">
        Calls: <b id="tt-cnt">0</b> &nbsp; Endpoints: <b id="tt-eps">0</b> &nbsp; Errores: <b id="tt-errs" style="color:#e83e8c">0</b>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px;">
        <button id="tt-highlight" style="cursor:pointer;border:0;border-radius:8px;padding:6px;">Highlight</button>
        <button id="tt-copy"      style="cursor:pointer;border:0;border-radius:8px;padding:6px;">Copy user</button>
        <button id="tt-export"    style="cursor:pointer;border:0;border-radius:8px;padding:6px;background:#00C4E9;color:#000;font-weight:700;">⬇ Export</button>
        <button id="tt-clear"     style="cursor:pointer;border:0;border-radius:8px;padding:6px;">Clear</button>
      </div>

      <div style="display:flex;gap:6px;margin-bottom:8px;">
        <input id="tt-endpoint" placeholder="/ruta/api (same-origin) o URL completa"
               style="flex:1;border-radius:8px;border:1px solid #444;padding:6px;background:#111;color:#fff;"/>
        <button id="tt-call" style="cursor:pointer;border:0;border-radius:8px;padding:6px 10px;">Call</button>
      </div>

      <div style="display:flex;gap:6px;margin-bottom:8px;">
        <button id="tt-show-net" style="cursor:pointer;border:0;border-radius:8px;padding:6px;flex:1;">Network log</button>
        <button id="tt-debug"    style="cursor:pointer;border:0;border-radius:8px;padding:6px;flex:1;">Debug: ON</button>
      </div>

      <pre id="tt-output" style="white-space:pre-wrap;background:#0f0f0f;border:1px solid #333;border-radius:10px;padding:8px;overflow:auto;max-height:28vh;margin:0;font-size:11px;"></pre>
    `;

    document.body.appendChild(panel);

    state.ui.panel        = panel;
    state.ui.output       = panel.querySelector("#tt-output");
    state.ui.endpointInput = panel.querySelector("#tt-endpoint");

    panel.querySelector("#tt-highlight").onclick = () => applyHighlight();

    panel.querySelector("#tt-copy").onclick = async () => {
      const el = getUserElement();
      if (!el) return alert("❌ No encontrado");
      await copyToClipboard(el.innerText);
    };

    panel.querySelector("#tt-call").onclick = () => {
      const v = state.ui.endpointInput.value.trim();
      if (!v) return alert("Pon una ruta o URL");
      apiCall(v);
    };

    panel.querySelector("#tt-show-net").onclick = () => renderNetwork(true);

    panel.querySelector("#tt-clear").onclick = () => {
      state.network = [];
      Object.keys(state.byPattern).forEach(k => delete state.byPattern[k]);
      updateStats();
      setOutput("🧹 Log limpiado");
    };

    panel.querySelector("#tt-export").onclick = () => doExport();

    panel.querySelector("#tt-debug").onclick = () => {
      CONFIG.debug = !CONFIG.debug;
      panel.querySelector("#tt-debug").textContent = `Debug: ${CONFIG.debug ? "ON" : "OFF"}`;
    };

    panel.querySelector("#tt-close").onclick = () => destroy();

    let minimized = false;
    panel.querySelector("#tt-min").onclick = () => {
      minimized = !minimized;
      ["#tt-output","#tt-endpoint","#tt-call","#tt-show-net","#tt-debug",
       "#tt-export","#tt-clear","#tt-stats"].forEach(sel => {
        const el = panel.querySelector(sel);
        if (el) el.style.display = minimized ? "none" : "";
      });
    };
  }

  function updateStats() {
    const cntEl  = document.getElementById("tt-cnt");
    const epsEl  = document.getElementById("tt-eps");
    const errsEl = document.getElementById("tt-errs");
    if (!cntEl) return;
    const totalErrors = Object.values(state.byPattern).reduce((s, e) => s + e.errors, 0);
    cntEl.textContent  = state.network.length;
    epsEl.textContent  = Object.keys(state.byPattern).length;
    errsEl.textContent = totalErrors;
    errsEl.style.color = totalErrors > 0 ? "#e83e8c" : "#00CFB9";
  }

  function renderNetwork(force = false) {
    if (!state.ui.output) return;
    updateStats();
    if (!force && !state.ui.output.textContent.startsWith("NET")) return;

    const lines = [];
    lines.push(`NET (${state.network.length} capturadas · ${Object.keys(state.byPattern).length} endpoints únicos):`);
    lines.push("ts | type | method | status | ms | url");
    lines.push("-".repeat(80));
    for (const n of state.network.slice(0, 30)) {
      lines.push(
        `${n.ts} | ${n.type} | ${n.method} | ${n.status} | ${n.ms}ms | ${n.url}` +
        (n.error ? `\n   error: ${n.error}` : "")
      );
    }
    setOutput(lines.join("\n"));
  }

  // ==== Observer for dynamic DOM ====
  function installObserver() {
    applyHighlight();
    const obs = new MutationObserver(() => applyHighlight());
    obs.observe(document.body, { childList: true, subtree: true });
    state.observer = obs;
  }

  // ==== Destroy ====
  function destroy() {
    try {
      if (state.observer) state.observer.disconnect();
      uninstallNetworkHooks();
      if (state.ui.panel) state.ui.panel.remove();
      window.__teamerToolkitLoaded = false;
      window.__teamerToolkit = null;
      console.log("🧹 TeamerToolkit desinstalado");
    } catch (e) {
      console.error(e);
    }
  }

  // ==== Public API ====
  window.__teamerToolkit.export      = buildAnalysis;
  window.__teamerToolkit.exportRaw   = buildRaw;
  window.__teamerToolkit.download    = doExport;
  window.__teamerToolkit.network     = state.network;
  window.__teamerToolkit.byPattern   = state.byPattern;

  // ==== Init ====
  installNetworkHooks();
  installObserver();
  createPanel();
  setOutput("✅ Listo (v3 · bodies ON).\n- Highlight aplicado.\n- Capturando: URL · status · request body · response body · headers.\n- Pulsa '⬇ Export' para descargar los 2 archivos JSON al terminar de navegar.");

})();
