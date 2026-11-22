// videos.html — rewarded video section.
// Credit comes ONLY from the provider's server-side confirmation.
// Until a rewarded-video provider zone is configured, the page honestly
// shows "coming soon". The claim endpoint enforces cooldown + daily cap
// and rejects client-only claims while no provider is connected.
(function () {
  "use strict";
  const CFG = window.PGEM_CONFIG;
  const $ = (s) => document.querySelector(s);

  async function init() {
    const user = await window.PGEM.requireAuth();
    if (!user) return;
    const status = $("#video-status");
    const btn = $("#watch-btn");
    const count = $("#video-count");
    const rv = CFG.rewardedVideo;

    if (!rv.zoneId) {
      status.textContent = "Rewarded videos are being connected — the video provider is being set up. Check back soon; the offer wall is live now.";
      btn.disabled = true;
      count.textContent = "";
      return;
    }

    status.textContent = "Ready — " + rv.coinsPerView + " coins per completed view, up to " + rv.maxViewsPerDay + " views/day.";
    btn.disabled = false;

    // Today's count (for display only — the server enforces the cap).
    const sb = window.PGEM.sb;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await sb.from("gpt_coin_transactions")
      .select("id", { count: "exact" })
      .eq("user_id", user.id).eq("type", "rewarded_video")
      .gte("created_at", today + "T00:00:00Z");
    const used = (data && data.length) || 0;
    count.textContent = "Watched today: " + used + " / " + rv.maxViewsPerDay;

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Playing video…";
      // The provider's rewarded interstitial is triggered here. The
      // provider fires its completion callback, which the page forwards
      // to the server with the provider's view token.
      // NOTE: the exact trigger call comes from the provider dashboard
      // (Monetag rewarded interstitial). Until it is wired, this button
      // cannot start a video — see README.md "Rewarded video".
      window.PGEM.toast("Video provider is not fully wired yet — the claim flow is ready, the provider tag is pending.", false);
      btn.disabled = false;
      btn.textContent = "Watch a video (+10 🪙)";
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
