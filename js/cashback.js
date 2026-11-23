// cashback.html — config-driven store list.
// Live stores are in js/config.js cashback.stores (approved Impact /
// Rakuten deals only — never show fake deals). Each store: { name, url,
// commissionPct (the STORE's commission; the user gets 50% of it as
// coins), category, desc, network, badge? }. Clicks are logged (own
// rows only) for reporting.
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
        <div class="flex items-center gap-3">
          <span class="flex-none w-11 h-11 rounded-xl bg-violet-600 text-white font-black text-xl flex items-center justify-center">${escapeHtml(String(s.name || "?").charAt(0))}</span>
          <div class="min-w-0">
            <h3 class="font-extrabold text-lg leading-tight">${escapeHtml(s.name)}</h3>
            <p class="text-xs text-slate-500">${escapeHtml(s.category || "Shopping")}${s.network ? " · " + escapeHtml(s.network) : ""}</p>
          </div>
          <span class="reward-pill ml-auto whitespace-nowrap">Up to ${escapeHtml(s.commissionPct)}% back</span>
        </div>
        ${s.desc ? `<p class="text-sm text-slate-600 mt-3">${escapeHtml(s.desc)}</p>` : ""}
        <div class="flex items-center justify-between mt-3">
          <p class="text-sm font-bold text-violet-600">Shop now →</p>
          ${s.badge ? `<span class="text-xs font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">${escapeHtml(s.badge)}</span>` : ""}
        </div>
      </a>`).join("");
    host.querySelectorAll("[data-store]").forEach((el) => {
      el.addEventListener("click", () => {
        const s = stores[Number(el.getAttribute("data-store"))];
        logClick(s.name, s.url);
      });
    });
  });
})();
