// music.html — chill zone (retention, NOT a main earner).
// A 15-minute listening session earns 5 coins (max 20/day), verified
// server-side by the music-claim edge function (elapsed time + caps).
// The music itself is a public lofi livestream embed.
(function () {
  "use strict";
  const CFG = window.PGEM_CONFIG;
  const $ = (s) => document.querySelector(s);
  const SESSION_MS = 15 * 60 * 1000; // 15 minutes per session

  let sessionStart = null;
  let timer = null;

  function fmt(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }

  function updateTimer() {
    if (!sessionStart) return;
    const elapsed = Date.now() - sessionStart;
    const left = SESSION_MS - elapsed;
    const el = $("#session-timer");
    const bar = $("#session-bar");
    if (bar) bar.style.width = Math.min(100, Math.round((elapsed / SESSION_MS) * 100)) + "%";
    if (left <= 0) {
      el.textContent = "Session complete — claim your coins!";
      $("#claim-btn").disabled = false;
      $("#claim-btn").textContent = "Claim +5 🪙";
      clearInterval(timer); timer = null;
      return;
    }
    el.textContent = fmt(left) + " left in this session";
  }

  async function init() {
    await window.PGEM.requireAuth();
    const startBtn = $("#start-btn");
    const claimBtn = $("#claim-btn");
    claimBtn.disabled = true;

    startBtn.addEventListener("click", () => {
      sessionStart = Date.now();
      startBtn.disabled = true;
      startBtn.textContent = "Listening… keep this tab open";
      claimBtn.disabled = true;
      claimBtn.textContent = "Claim +5 🪙";
      timer = setInterval(updateTimer, 1000);
      updateTimer();
    });

    // Pause the clock when the tab is hidden (prevents idle farming).
    let hiddenAt = null;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        if (timer) { clearInterval(timer); timer = null; }
      } else if (hiddenAt && sessionStart) {
        sessionStart += Date.now() - hiddenAt; // shift start forward by hidden time
        hiddenAt = null;
        if (!timer) timer = setInterval(updateTimer, 1000);
      }
    });

    claimBtn.addEventListener("click", async () => {
      claimBtn.disabled = true;
      // ROOT-CAUSE FIX (23/11): same uncaught-throw flaw as surveys.js —
      // a callFn throw used to leave the claim button disabled forever.
      // callFn now returns { error } instead of throwing; the try/catch
      // stays as a second layer so the button always recovers.
      let r;
      try {
        r = await window.PGEM.callFn("music-claim", { started_at: new Date(sessionStart).toISOString() });
      } catch (e) {
        r = { error: "network_error" };
      }
      if (!r || r.error) { window.PGEM.toast("Claim failed: " + ((r && r.error) || "network_error"), false); claimBtn.disabled = false; return; }
      window.PGEM.toast("+" + r.coins + " coins! (" + r.claimed_today + "/" + (CFG.coins.musicDailyCapCoins / CFG.coins.musicCoinsPerSession) + " sessions today)");
      await window.PGEM.loadBalance();
      sessionStart = null; startBtn.disabled = false; startBtn.textContent = "Start a 15-min session";
      $("#session-timer").textContent = "Ready when you are.";
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
