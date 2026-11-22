// wallet.html — balance, transaction history, withdrawal requests.
(function () {
  "use strict";
  const CFG = window.PGEM_CONFIG;
  const $ = (s) => document.querySelector(s);

  function levelProgress(b) {
    const levels = CFG.coins.levels;
    const cur = levels.find((l) => l.level === (b.level || 1)) || levels[0];
    const next = levels.find((l) => l.level === (b.level || 1) + 1);
    if (!next) return { cur, next: null, pct: 100 };
    // Level is earned by USD OR offers — show the better of the two tracks.
    const usdPct = Number(b.lifetime_earned_usd || 0) / next.minEarnedUsd;
    const offersPct = Number(b.offers_completed || 0) / next.minOffers;
    const pct = Math.min(100, Math.round(Math.max(usdPct, offersPct) * 100));
    return { cur, next, pct };
  }

  async function init() {
    const user = await window.PGEM.requireAuth();
    if (!user) return;
    const sb = window.PGEM.sb;
    await window.PGEM.loadBalance();
    const b = window.PGEM.balance || {};

    // Level card
    const lp = levelProgress(b);
    $("#level-name").textContent = lp.cur.name + " (Level " + lp.cur.level + ")";
    $("#level-max").textContent = "$" + lp.cur.maxWithdrawUsd + " per withdrawal";
    $("#level-bar").style.width = lp.pct + "%";
    $("#level-next").textContent = lp.next
      ? lp.pct + "% to Level " + lp.next.level + " (" + lp.next.name + ", up to $" + lp.next.maxWithdrawUsd + "/withdrawal — earn $" + lp.next.minEarnedUsd + " total or finish " + lp.next.minOffers + " offers)"
      : "Max level reached — highest withdrawal limit unlocked.";
    $("#locked-coins").textContent = window.PGEM.fmtCoins(b.locked_coins || 0);
    $("#lifetime-earned").textContent = "$" + Number(b.lifetime_earned_usd || 0).toFixed(2);

    // Payout schedule note (gradual model — no bulk waves).
    $("#payout-note").textContent =
      "Withdrawals are reviewed by hand and paid in batches every Tuesday and Friday. " +
      "Your first withdrawal is held " + CFG.coins.firstWithdrawHoldHours + "h for a fraud check. " +
      "New accounts can withdraw up to $" + lp.cur.maxWithdrawUsd + " at a time; your limit grows as you level up.";

    // Transactions
    const { data: txs } = await sb.from("gpt_coin_transactions")
      .select("amount_coins,type,source,offer_name,created_at,status")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    const txHost = $("#tx-list");
    if (!txs || !txs.length) {
      txHost.innerHTML = '<p class="text-slate-500 text-sm">No transactions yet. Complete your first offer to see it here.</p>';
    } else {
      txHost.innerHTML = txs.map((t) => `
        <div class="flex justify-between py-2 border-b border-slate-100 text-sm">
          <div><span class="font-medium">${escapeHtml(t.offer_name || t.type)}</span>
            <span class="text-slate-400"> · ${escapeHtml(t.source || "")}${t.status === "locked" ? " · locked" : ""}</span></div>
          <div class="text-right"><span class="${t.amount_coins >= 0 ? "text-emerald-600" : "text-red-600"} font-semibold">${t.amount_coins >= 0 ? "+" : ""}${window.PGEM.fmtCoins(t.amount_coins)}</span>
          <div class="text-xs text-slate-400">${new Date(t.created_at).toLocaleDateString("en-US")}</div></div>
        </div>`).join("");
    }

    // Withdrawals
    const { data: wds } = await sb.from("gpt_withdrawals")
      .select("amount_usd,method,status,created_at,hold_until,payout_batch")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    const wdHost = $("#wd-list");
    if (!wds || !wds.length) {
      wdHost.innerHTML = '<p class="text-slate-500 text-sm">No withdrawal requests yet.</p>';
    } else {
      wdHost.innerHTML = wds.map((w) => `
        <div class="flex justify-between py-2 border-b border-slate-100 text-sm">
          <div><span class="font-medium">$${Number(w.amount_usd).toFixed(2)} via ${escapeHtml(w.method)}</span>
            <div class="text-xs text-slate-400">${new Date(w.created_at).toLocaleDateString("en-US")}${w.payout_batch ? " · batch " + w.payout_batch : ""}</div></div>
          <span class="font-semibold ${w.status === "paid" ? "text-emerald-600" : w.status === "rejected" ? "text-red-600" : "text-amber-600"}">${w.status}</span>
        </div>`).join("");
    }

    // Withdrawal form
    const form = $("#withdraw-form");
    const methodSel = $("#wd-method");
    const amountInp = $("#wd-amount");
    const destInp = $("#wd-dest");
    const destLabel = $("#wd-dest-label");
    const minNote = $("#wd-min-note");
    function syncMethod() {
      const m = methodSel.value;
      destLabel.textContent = m === "paypal" ? "PayPal email" : "LTC / USDT wallet address";
      destInp.placeholder = m === "paypal" ? "you@example.com" : "Your LTC or USDT address";
      minNote.textContent = m === "paypal"
        ? "Minimum $" + CFG.coins.minWithdrawPaypalUsd + " · fee ~2%"
        : "Minimum $" + CFG.coins.minWithdrawCryptoUsd + " · network fee only";
    }
    methodSel.addEventListener("change", syncMethod);
    syncMethod();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const amount = Number(amountInp.value);
      const dest = destInp.value.trim();
      if (!amount || amount <= 0) { window.PGEM.toast("Enter an amount.", false); return; }
      const minUsd = methodSel.value === "paypal" ? CFG.coins.minWithdrawPaypalUsd : CFG.coins.minWithdrawCryptoUsd;
      if (amount < minUsd) { window.PGEM.toast("Minimum withdrawal is $" + minUsd + " via " + (methodSel.value === "paypal" ? "PayPal" : "crypto") + ".", false); return; }
      if (amount > lp.cur.maxWithdrawUsd) { window.PGEM.toast("Your level (" + lp.cur.name + ") allows up to $" + lp.cur.maxWithdrawUsd + " per withdrawal. Level up to withdraw more.", false); return; }
      if (!dest) { window.PGEM.toast("Enter your payout destination.", false); return; }
      const r = await window.PGEM.callFn("request-withdrawal", {
        method: methodSel.value, amount_usd: amount, destination: dest,
      });
      if (r.error) { window.PGEM.toast("Withdrawal request failed: " + r.error, false); return; }
      window.PGEM.toast("Request received. It will be reviewed and paid in the next batch (" + r.payout_batch + ").");
      form.reset(); syncMethod();
      setTimeout(() => location.reload(), 1200);
    });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
