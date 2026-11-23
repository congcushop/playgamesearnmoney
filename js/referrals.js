// referrals.html — referral link, code, stats.
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);

  async function init() {
    const user = await window.PGEM.requireAuth();
    if (!user) return;
    const sb = window.PGEM.sb;
    const profile = window.PGEM.profile || {};
    const code = profile.referral_code || "";
    // NOTE: the base URL lives at PGEM_CONFIG.site.baseUrl (top-level
    // PGEM_CONFIG.baseUrl is undefined — it used to render "undefined/…").
    const link = window.PGEM_CONFIG.site.baseUrl + "/login.html?mode=signup&ref=" + encodeURIComponent(code);
    $("#ref-link").value = link;
    $("#ref-code").textContent = code || "—";
    $("#copy-ref").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(link); window.PGEM.toast("Referral link copied!"); }
      catch (e) { $("#ref-link").select(); document.execCommand("copy"); window.PGEM.toast("Referral link copied!"); }
    });

    const { count } = await sb.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", user.id);
    $("#ref-count").textContent = count || 0;

    const { data: refs } = await sb.from("coin_transactions")
      .select("amount_coins,created_at,meta")
      .eq("user_id", user.id).eq("source", "referral")
      .order("created_at", { ascending: false }).limit(20);
    const total = (refs || []).reduce((a, r) => a + Number(r.amount_coins || 0), 0);
    $("#ref-earned-coins").textContent = window.PGEM.fmtCoins(total);
    $("#ref-earned-usd").textContent = "$" + window.PGEM.coinsToUsd(total);
    const host = $("#ref-list");
    if (!refs || !refs.length) {
      host.innerHTML = '<p class="text-slate-500 text-sm">No referral earnings yet — share your link and they will show up here.</p>';
    } else {
      host.innerHTML = refs.map((r) => `
        <div class="flex justify-between py-2 border-b border-slate-100 text-sm">
          <span>${(r.meta && r.meta.offer) || "Referral bonus"}</span>
          <span class="text-emerald-600 font-semibold">+${window.PGEM.fmtCoins(r.amount_coins)}</span>
        </div>`).join("");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
