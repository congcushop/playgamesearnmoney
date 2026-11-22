// surveys.html — CPX Research + TheoremReach routers.
// CPX iframe URL is signed SERVER-SIDE (secure_hash needs the app secret),
// so the page asks the edge function for a signed URL instead of building
// it in the browser. TheoremReach opens its router entry link in a new tab.
(function () {
  "use strict";
  const CFG = window.PGEM_CONFIG;
  const $ = (s) => document.querySelector(s);

  function pendingMsg(host, title, text) {
    host.innerHTML = `<div class="border border-dashed border-slate-300 rounded-xl p-4 text-center text-sm text-slate-500">
      <p class="font-semibold text-slate-700">${title}</p><p class="mt-1">${text}</p></div>`;
  }

  async function init() {
    const user = await window.PGEM.requireAuth();
    if (!user) return;

    // --- CPX Research ---
    const cpxBtn = $("#cpx-open");
    cpxBtn.addEventListener("click", async () => {
      if (!CFG.cpx.appId) {
        pendingMsg($("#cpx-host"), "CPX Research is being connected",
          "The CPX publisher account is being set up. Try TheoremReach or the offer wall meanwhile.");
        return;
      }
      cpxBtn.disabled = true; cpxBtn.textContent = "Loading CPX…";
      const r = await window.PGEM.callFn("survey-url", { router: "cpx" });
      if (r.error || !r.url) {
        window.PGEM.toast("Could not open CPX right now: " + (r.error || "unknown error"), false);
        cpxBtn.disabled = false; cpxBtn.textContent = "Open CPX surveys →";
        return;
      }
      const host = $("#cpx-frame-host");
      host.innerHTML = "";
      const f = document.createElement("iframe");
      f.src = r.url; f.style.width = "100%"; f.style.height = "2000px";
      f.style.border = "0"; f.setAttribute("title", "CPX Research surveys");
      host.appendChild(f);
      host.scrollIntoView({ behavior: "smooth" });
      cpxBtn.textContent = "CPX surveys open below ↓";
    });

    // --- TheoremReach ---
    const trBtn = $("#tr-open");
    trBtn.addEventListener("click", async () => {
      if (!CFG.theoremreach.apiKey) {
        pendingMsg($("#tr-host"), "TheoremReach is being connected",
          "The TheoremReach publisher account is being set up. Try CPX or the offer wall meanwhile.");
        return;
      }
      const r = await window.PGEM.callFn("survey-url", { router: "theoremreach" });
      if (r.error || !r.url) {
        window.PGEM.toast("Could not open TheoremReach right now: " + (r.error || "unknown error"), false);
        return;
      }
      window.open(r.url, "_blank", "noopener");
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
