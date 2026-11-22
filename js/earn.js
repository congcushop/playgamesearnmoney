// earn.html — offerwall embed + category tabs.
// The wall itself is the task flow: NO display ads are rendered inside it.
(function () {
  "use strict";
  const CFG = window.PGEM_CONFIG;
  const $ = (s) => document.querySelector(s);

  function wallFrame(url, height) {
    const f = document.createElement("iframe");
    f.src = url; f.style.width = "100%"; f.style.height = (height || 800) + "px";
    f.style.border = "0"; f.setAttribute("loading", "lazy");
    f.setAttribute("title", "Offer wall");
    return f;
  }

  function pendingCard(title, text) {
    const d = document.createElement("div");
    d.className = "border border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-500";
    d.innerHTML = `<p class="font-semibold text-slate-700">${title}</p><p class="mt-1 text-sm">${text}</p>`;
    return d;
  }

  async function init() {
    const user = await window.PGEM.requireAuth();
    if (!user) return;
    const host = $("#wall-host");
    const tabGg = $("#tab-offerwallgg");
    const tabAdgem = $("#tab-adgem");
    const note = $("#wall-note");

    function showGg() {
      host.innerHTML = "";
      if (CFG.offerwallGg.placementKey) {
        host.appendChild(wallFrame(
          "https://offerwall.gg/wall/" + encodeURIComponent(CFG.offerwallGg.placementKey)
          + "?userId=" + encodeURIComponent(user.id), 820));
        note.textContent = "Complete offers inside the wall. Coins credit automatically when an offer is verified — games can take a few days to credit.";
      } else {
        host.appendChild(pendingCard("Offer wall is being connected",
          "The Offerwall.GG placement is being set up. Meanwhile, try surveys, trials and the other ways to earn from the menu — they credit the same way."));
      }
      tabGg.classList.add("bg-violet-600", "text-white");
      tabGg.classList.remove("bg-white", "text-slate-700");
      tabAdgem.classList.remove("bg-violet-600", "text-white");
      tabAdgem.classList.add("bg-white", "text-slate-700");
    }
    function showAdgem() {
      host.innerHTML = "";
      if (CFG.adgem.wallUrl) {
        host.appendChild(wallFrame(CFG.adgem.wallUrl + (CFG.adgem.wallUrl.indexOf("?") === -1 ? "?" : "&")
          + "player_id=" + encodeURIComponent(user.id), 820));
        note.textContent = "AdGem wall — a second set of offers. Same coins, same wallet.";
      } else {
        host.appendChild(pendingCard("AdGem wall is being connected",
          "The AdGem property is waiting for approval. The Offerwall.GG wall above is the main one for now."));
      }
      tabAdgem.classList.add("bg-violet-600", "text-white");
      tabAdgem.classList.remove("bg-white", "text-slate-700");
      tabGg.classList.remove("bg-violet-600", "text-white");
      tabGg.classList.add("bg-white", "text-slate-700");
    }
    tabGg.addEventListener("click", showGg);
    tabAdgem.addEventListener("click", showAdgem);
    showGg();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
