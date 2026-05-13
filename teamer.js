(function () {
  console.log("🚀 Teamer Toolkit iniciado");

  const selector = "#TeamerHeader span";

  function highlight() {
    const el = document.querySelector(selector);
    if (el && !el.dataset.hl) {
      el.style.backgroundColor = "yellow";
      el.style.padding = "2px 4px";
      el.style.borderRadius = "4px";
      el.style.outline = "2px solid orange";
      el.dataset.hl = "1";
      console.log("✅ Highlight aplicado:", el.innerText);
    }
  }

  highlight();

  const observer = new MutationObserver(() => highlight());
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

})();
