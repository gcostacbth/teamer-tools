(function () {
  if (window.__teamerToolkitLoaded) {
    console.log("⚠️ Ya cargado");
    return;
  }
  window.__teamerToolkitLoaded = true;

  console.log("🚀 Teamer Toolkit iniciado");

  const CONFIG = {
    selector: "#TeamerHeader span",
    debug: true
  };

  function log(...args) {
    if (CONFIG.debug) {
      console.log("[TeamerToolkit]", ...args);
    }
  }

  function getUserElement() {
    return document.querySelector(CONFIG.selector);
  }

  function highlight() {
    const el = getUserElement();
    if (el && !el.dataset.hl) {
      el.style.backgroundColor = "yellow";
      el.style.padding = "2px 4px";
      el.style.borderRadius = "4px";
      el.style.outline = "2px solid orange";
      el.dataset.hl = "1";
      log("✅ Highlight aplicado:", el.innerText);
    }
  }

  function copyUser() {
    const el = getUserElement();
    if (!el) return alert("❌ Usuario no encontrado");

    navigator.clipboard.writeText(el.innerText);
    alert("✅ Copiado: " + el.innerText);
  }

  function showInfo() {
    const el = getUserElement();
    if (!el) return alert("❌ Usuario no encontrado");

    alert("👤 Usuario: " + el.innerText);
  }

  function reload() {
    location.reload();
  }

  function initObserver() {
    const observer = new MutationObserver(() => highlight());
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function createPanel() {
    const panel = document.createElement("div");

    panel.style.position = "fixed";
    panel.style.bottom = "10px";
    panel.style.right = "10px";
    panel.style.background = "#222";
    panel.style.color = "#fff";
    panel.style.padding = "10px";
    panel.style.borderRadius = "8px";
    panel.style.zIndex = "99999";
    panel.style.fontSize = "12px";
    panel.style.boxShadow = "0 2px 10px rgba(0,0,0,0.3)";

    panel.innerHTML = `
      <div style="margin-bottom:6px;"><b>Teamer Toolkit</b></div>
      <button id="tt-highlight">Highlight</button>
      <button id="tt-copy">Copy</button>
      <button id="tt-info">Info</button>
      <button id="tt-reload">Reload</button>
    `;

    document.body.appendChild(panel);

    // eventos
    document.getElementById("tt-highlight").onclick = highlight;
    document.getElementById("tt-copy").onclick = copyUser;
    document.getElementById("tt-info").onclick = showInfo;
    document.getElementById("tt-reload").onclick = reload;
  }

  // INIT
  highlight();
  initObserver();
  createPanel();

})();
