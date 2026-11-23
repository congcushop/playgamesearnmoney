// cashback.html — config-driven store list.
// The list starts EMPTY on purpose: no fake deals. Real affiliate stores
// are added in js/config.js once deals are signed (Rakuten / Impact /
// Awin / ShareASale). Clicks are logged (own rows only) for reporting.
(function () {
  "use strict";
  const CFG = window.PGEM_CONFIG;
  const $ = (s) => document.querySelector(s);

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  async function logClick(storeName, url) {
    const sb = window.PGEM.sb;
    const user = window.PGEM.user;
    if (!sb || !user) return;
    // Canonical table (see shared/fix-lifetime-earned.sql): the old
    // gpt_cashback_clicks table only existed in the retired site #1-only
    // schema, never in the shared backend.
    await sb.from("cashback_clicks").insert({
      user_id: user.id, store_name: storeName, url,
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await window.PGEM.refreshSession();
    const host = $("#stores-host");
    const stores = CFG.cashback.stores || [];
    if (!stores.length) {
      host.innerHTML = `
        <div class="earn-card p-6 sm:col-span-2 lg:col-span-3 text-center">
          <div class="text-4xl">🛍️</div>
          <h2 class="font-extrabold text-xl mt-3">Cashback stores are coming soon</h2>
          <p class="text-slate-500 text-sm mt-2 max-w-md mx-auto">
            We're signing cashback deals with real stores now. Once they're live, every
            store here pays you coins back on real orders — no fake deals, no made-up
            percentages. Meanwhile, the <a class="text-violet-600 font-bold" href="earn.html">offer wall</a>
            is where the money is.</p>
        </div>`;
      return;
    }
    host.innerHTML = stores.map((s, i) => `
      <a href="${escapeHtml(s.url)}" data-store="${i}" target="_blank" rel="sponsored nofollow noopener" class="earn-card offer-tile p-5 block">
        <div class="flex items-center justify-between">
          <h3 class="font-extrabold text-lg">${escapeHtml(s.name)}</h3>
          <span class="reward-pill">Up to ${escapeHtml(s.commissionPct)}% back</span>
        </div>
        <p class="text-sm text-slate-500 mt-1">${escapeHtml(s.category || "Shopping")}</p>
        <p class="text-sm font-bold text-violet-600 mt-3">Shop now →</p>
      </a>`).join("");
    host.querySelectorAll("[data-store]").forEach((el) => {
      el.addEventListener("click", () => {
        const s = stores[Number(el.getAttribute("data-store"))];
        logClick(s.name, s.url);
      });
    });
  });
})();
