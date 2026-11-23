// proof.html — payout proof wall. ONLY real paid withdrawals from the DB.
// Usernames are masked. No fake proofs ever.
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);

  document.addEventListener("DOMContentLoaded", async () => {
    const host = $("#proof-list");
    const sb = window.PGEM.sb;
    if (!sb) {
      host.innerHTML = `
        <div class="earn-card p-6 text-center">
          <div class="text-4xl">💸</div>
          <h2 class="font-extrabold text-xl mt-3">No payouts yet — be the first</h2>
          <p class="text-slate-500 text-sm mt-2 max-w-md mx-auto">
            This wall fills itself with real payouts as soon as users start cashing out.
            We don't fake proofs. The first real payout will appear here automatically.</p>
        </div>`;
      return;
    }
    // Canonical table: payout_proofs (public read). Totals computed here.
    const { data, error } = await sb.from("payout_proofs")
      .select("display_name,amount_usd,method,paid_at")
      .order("paid_at", { ascending: false }).limit(50);
    const proofs = data || [];
    if (error || !proofs.length) {
      host.innerHTML = `
        <div class="earn-card p-6 text-center">
          <div class="text-4xl">💸</div>
          <h2 class="font-extrabold text-xl mt-3">No payouts yet — be the first</h2>
          <p class="text-slate-500 text-sm mt-2 max-w-md mx-auto">
            This wall fills itself with real payouts as soon as users start cashing out.
            We don't fake proofs. The first real payout will appear here automatically.</p>
        </div>`;
      $("#proof-total-paid").textContent = "$0";
      $("#proof-count").textContent = "0";
      $("#proof-biggest").textContent = "$0";
      return;
    }
    const totalPaid = proofs.reduce((a, w) => a + Number(w.amount_usd || 0), 0);
    const biggest = proofs.reduce((m, w) => Math.max(m, Number(w.amount_usd || 0)), 0);
    $("#proof-total-paid").textContent = "$" + totalPaid.toFixed(2);
    $("#proof-count").textContent = String(proofs.length);
    $("#proof-biggest").textContent = "$" + biggest.toFixed(2);
    host.innerHTML = proofs.map((w) => `
      <div class="earn-card p-4 flex items-center gap-3">
        <span class="text-2xl">${w.method === "paypal" ? "💙" : "₿"}</span>
        <div class="flex-1">
          <p class="font-extrabold">${w.display_name} withdrew <span class="text-emerald-600">$${Number(w.amount_usd).toFixed(2)}</span></p>
          <p class="text-xs text-slate-400">via ${w.method === "paypal" ? "PayPal" : "crypto"} · ${new Date(w.paid_at).toLocaleDateString("en-US")}</p>
        </div>
        <span class="reward-pill">✓ Paid</span>
      </div>`).join("");
  });
})();
