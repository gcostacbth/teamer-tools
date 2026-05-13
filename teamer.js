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
    maxNetworkLog: 50,
    apiTimeoutMs: 10000,
  };

  const state = {
    observer: null,
    network: [],
    origFetch: window.fetch ? window.fetch.bind(window) : null,
    origXHROpen: XMLHttpRequest.prototype.open,
    origXHRSend: XMLHttpRequest.prototype.send,
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

  function pushNetwork(entry) {
    state.network.unshift(entry);
    if (state.network.length > CONFIG.maxNetworkLog) state.network.pop();
    renderNetwork();
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

  // ==== Network intercept (fetch + XHR) ====
  function installNetworkHooks() {
    // Hook fetch
    if (state.origFetch) {
      window.fetch = async function (input, init = {}) {
        const start = performance.now();
        const method = (init && init.method) ? init.method : "GET";
        const url = typeof input === "string" ? input : (input && input.url) ? input.url : String(input);

        try {
          const res = await state.origFetch(input, init);
          const ms = Math.round(performance.now() - start);
          pushNetwork({ ts: nowIso(), type: "fetch", method, url, status: res.status, ms });
          return res;
        } catch (err) {
          const ms = Math.round(performance.now() - start);
          pushNetwork({ ts: nowIso(), type: "fetch", method, url, status: "ERR", ms, error: String(err) });
          throw err;
        }
      };
    }

    // Hook XHR
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__tt = { method, url, start: 0 };
      return state.origXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      if (this.__tt) this.__tt.start = performance.now();

      this.addEventListener("loadend", function () {
        if (!this.__tt) return;
        const ms = Math.round(performance.now() - this.__tt.start);
        pushNetwork({
          ts: nowIso(),
          type: "xhr",
          method: this.__tt.method || "GET",
          url: this.__tt.url,
          status: this.status,
          ms
        });
      });

      return state.origXHRSend.apply(this, arguments);
    };

    log("✅ Network hooks instalados");
  }

  function uninstallNetworkHooks() {
    if (state.origFetch) window.fetch = state.origFetch;
    XMLHttpRequest.prototype.open = state.origXHROpen;
    XMLHttpRequest.prototype.send = state.origXHRSend;
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

      pushNetwork({ ts: nowIso(), type: "api", method: "GET", url, status: res.status, ms });
      setOutput(
        `GET ${url}\nStatus: ${res.status}\nContent-Type: ${contentType}\n\n` +
        safeText(body)
      );
    } catch (e) {
      const ms = Math.round(performance.now() - start);
      pushNetwork({ ts: nowIso(), type: "api", method: "GET", url, status: "ERR", ms, error: String(e) });
      setOutput(`❌ Error llamando ${url}\n${String(e)}`);
    } finally {
      clearTimeout(t);
    }
  }

  function normalizeUrl(pathOrUrl) {
    // Si es absoluta, la usamos tal cual
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    // Si es relativa, la hacemos same-origin
    const base = window.location.origin;
    const p = pathOrUrl.startsWith("/") ? pathOrUrl : ("/" + pathOrUrl);
    return base + p;
  }

  // ==== UI ====
  function createPanel() {
    const panel = document.createElement("div");
    panel.id = "tt-panel";
    panel.style.cssText = [
      "position:fixed",
      "bottom:10px",
      "right:10px",
      "width:360px",
      "max-height:60vh",
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
        <div><b>Teamer Toolkit</b> <span style="opacity:.7">v2</span></div>
        <div style="display:flex;gap:6px;">
          <button id="tt-min" style="cursor:pointer;border:0;border-radius:6px;padding:4px 8px;">_</button>
          <button id="tt-close" style="cursor:pointer;border:0;border-radius:6px;padding:4px 8px;">X</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px;">
        <button id="tt-highlight" style="cursor:pointer;border:0;border-radius:8px;padding:6px;">Highlight</button>
        <button id="tt-copy" style="cursor:pointer;border:0;border-radius:8px;padding:6px;">Copy user</button>
        <button id="tt-export" style="cursor:pointer;border:0;border-radius:8px;padding:6px;">Export log</button>
        <button id="tt-clear" style="cursor:pointer;border:0;border-radius:8px;padding:6px;">Clear</button>
      </div>

      <div style="display:flex;gap:6px;margin-bottom:8px;">
        <input id="tt-endpoint" placeholder="/ruta/api (same-origin) o URL completa"
               style="flex:1;border-radius:8px;border:1px solid #444;padding:6px;background:#111;color:#fff;"/>
        <button id="tt-call" style="cursor:pointer;border:0;border-radius:8px;padding:6px 10px;">Call</button>
      </div>

      <div style="display:flex;gap:6px;margin-bottom:8px;">
        <button id="tt-show-net" style="cursor:pointer;border:0;border-radius:8px;padding:6px;flex:1;">Network (últimas)</button>
        <button id="tt-debug" style="cursor:pointer;border:0;border-radius:8px;padding:6px;flex:1;">Debug: ON</button>
      </div>

      <pre id="tt-output" style="white-space:pre-wrap;background:#0f0f0f;border:1px solid #333;border-radius:10px;padding:8px;overflow:auto;max-height:30vh;margin:0;"></pre>
    `;

    document.body.appendChild(panel);

    state.ui.panel = panel;
    state.ui.output = panel.querySelector("#tt-output");
    state.ui.endpointInput = panel.querySelector("#tt-endpoint");

    // Wire buttons
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
      setOutput("🧹 Log limpiado");
    };

    panel.querySelector("#tt-export").onclick = async () => {
      await copyToClipboard(JSON.stringify(state.network, null, 2));
    };

    panel.querySelector("#tt-debug").onclick = () => {
      CONFIG.debug = !CONFIG.debug;
      panel.querySelector("#tt-debug").textContent = `Debug: ${CONFIG.debug ? "ON" : "OFF"}`;
    };

    panel.querySelector("#tt-close").onclick = () => {
      destroy();
    };

    let minimized = false;
    panel.querySelector("#tt-min").onclick = () => {
      minimized = !minimized;
      state.ui.output.style.display = minimized ? "none" : "block";
      panel.querySelector("#tt-endpoint").style.display = minimized ? "none" : "block";
      panel.querySelector("#tt-call").style.display = minimized ? "none" : "inline-block";
      panel.querySelector("#tt-show-net").style.display = minimized ? "none" : "inline-block";
      panel.querySelector("#tt-debug").style.display = minimized ? "none" : "inline-block";
      panel.querySelector("#tt-export").style.display = minimized ? "none" : "inline-block";
      panel.querySelector("#tt-clear").style.display = minimized ? "none" : "inline-block";
    };
  }

  function renderNetwork(force = false) {
    if (!state.ui.output) return;
    if (!force && state.ui.output.textContent.startsWith("NET")) return;

    const lines = [];
    lines.push("NET (últimas " + state.network.length + "):");
    lines.push("ts | type | method | status | ms | url");
    lines.push("-".repeat(80));
    for (const n of state.network.slice(0, 20)) {
      lines.push(
        `${n.ts} | ${n.type} | ${n.method} | ${n.status} | ${n.ms} | ${n.url}` +
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
      console.log("🧹 TeamerToolkit desinstalado (en esta pestaña)");
    } catch (e) {
      console.error(e);
    }
  }

  // ==== Init ====
  installNetworkHooks();
  installObserver();
  createPanel();
  setOutput("✅ Listo.\n- Highlight aplicado.\n- Network logger activo.\n- Para probar API: escribe una ruta (ej: /algo) y pulsa Call.");

})();
