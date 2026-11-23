// ============================================================================
// PlayGamesEarnMoney — shared core JS (auth, balances, ads, push, UI)
// Loaded on every page after config.js + the Supabase CDN script.
// Rules: client NEVER decides coin balances — all credits go through the
// server (Edge Functions + SQL RPCs). The client only reads + requests.
// ============================================================================
(function () {
  "use strict";
  const CFG = window.PGEM_CONFIG;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // --- Supabase client (null until configured) -------------------------------
  let sb = null;
  if (CFG.isBackendConfigured() && window.supabase) {
    sb = window.supabase.createClient(CFG.supabase.url, CFG.supabase.anonKey);
  }
  window.PGEM = { sb, user: null, profile: null, balance: null };

  // --- Tiny helpers -----------------------------------------------------------
  function toast(msg, ok) {
    let el = $("#pgem-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "pgem-toast";
      el.className = "fixed left-1/2 -translate-x-1/2 bottom-20 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = ok === false ? "#dc2626" : "#111827";
    el.style.color = "#fff";
    el.style.display = "block";
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.style.display = "none"), 4000);
  }
  window.PGEM.toast = toast;

  function fmtCoins(c) { return Number(c || 0).toLocaleString("en-US"); }
  function coinsToUsd(c) { return (Number(c || 0) / CFG.coins.perDollar).toFixed(2); }
  window.PGEM.fmtCoins = fmtCoins;
  window.PGEM.coinsToUsd = coinsToUsd;

  // Device fingerprint (simple, no third-party lib): canvas + UA + screen.
  // Only a hash is stored — never raw device data.
  async function deviceFingerprint() {
    try {
      const c = document.createElement("canvas");
      const x = c.getContext("2d");
      x.textBaseline = "top"; x.font = "14px Arial";
      x.fillText("pgem-fp", 2, 2);
      const raw = [
        navigator.userAgent, screen.width + "x" + screen.height,
        screen.colorDepth, Intl.DateTimeFormat().resolvedOptions().timeZone,
        navigator.language, c.toDataURL(),
      ].join("|");
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (e) { return "unavailable"; }
  }
  window.PGEM.deviceFingerprint = deviceFingerprint;

  // --- Auth -------------------------------------------------------------------
  // Session state: null = unknown (still loading), user object / null = known.
  // The header must NOT render the logged-out links until the session is
  // known — otherwise every page flickers "Log in" for a second.
  let sessionReady = false;

  async function refreshSession() {
    if (!sb) {
      // Backend not configured: still reveal guest content (the CSS auth
      // gating hides [data-user-only]/[data-guest-only] until .auth-ready).
      document.body.classList.add("auth-ready");
      return null;
    }
    const { data } = await sb.auth.getSession();
    window.PGEM.user = (data && data.session && data.session.user) || null;
    if (window.PGEM.user) {
      await loadProfile();
      // Apply a referral code saved at sign-up (email-confirmation flow).
      try {
        const pending = localStorage.getItem("pgem_pending_ref");
        if (pending) {
          const { error } = await sb.rpc("apply_referral", { p_user_id: window.PGEM.user.id, p_code: pending });
          if (!error) localStorage.removeItem("pgem_pending_ref");
        }
      } catch (e) { /* storage unavailable — referral code already lost, not fatal */ }
    }
    sessionReady = true;
    // Round-2 FOUC fix: reveal auth-dependent content ONLY once the
    // session is known (and, for logged-in users, the balance is loaded
    // via loadProfile above) — never flash "…" or login links first.
    document.body.classList.add("auth-ready");
    document.body.classList.toggle("auth-logged-in", !!window.PGEM.user);
    renderAuthArea();
    return window.PGEM.user;
  }

  async function loadProfile() {
    if (!sb || !window.PGEM.user) return;
    // Canonical table is `profiles` (created by the auth.users trigger).
    // A missing row must NOT block the balance: load it regardless.
    const { data } = await sb.from("profiles").select("*").eq("id", window.PGEM.user.id).maybeSingle();
    window.PGEM.profile = data || null;
    await loadBalance();
  }

  async function loadBalance() {
    if (!sb || !window.PGEM.user) return;
    // Canonical derived view: balance + lifetime + level + offers in ONE
    // query (needs GRANT SELECT on user_balances — see shared SQL fix).
    const { data, error } = await sb.from("user_balances")
      .select("balance_coins, lifetime_coins_earned, level, offers_completed")
      .eq("user_id", window.PGEM.user.id)
      .maybeSingle();
    if (error || !data) {
      // No view row yet (profile still being created) — show real zeros,
      // not a stuck "…".
      window.PGEM.balance = {
        available_coins: 0, locked_coins: 0, lifetime_earned_usd: 0,
        offers_completed: 0, level: 1, level_name: "Rookie", max_withdraw_usd: 10,
      };
    } else {
      const lvl = CFG.coins.levels.find((l) => l.level === (data.level || 1)) || CFG.coins.levels[0];
      window.PGEM.balance = {
        available_coins: Number(data.balance_coins || 0),
        locked_coins: 0, // signup bonus credits only after the first offer
        lifetime_earned_usd: Number(data.lifetime_coins_earned || 0) / CFG.coins.perDollar,
        offers_completed: Number(data.offers_completed || 0),
        level: data.level || 1,
        level_name: lvl.name,
        max_withdraw_usd: lvl.maxWithdrawUsd,
      };
    }
    const b = window.PGEM.balance;
    $$("[data-balance-coins]").forEach((el) => (el.textContent = fmtCoins(b.available_coins)));
    $$("[data-balance-usd]").forEach((el) => (el.textContent = coinsToUsd(b.available_coins)));
    $$("[data-level-name]").forEach((el) => (el.textContent = b.level_name || "Rookie"));
    $$("[data-level-max]").forEach((el) => (el.textContent = "$" + (b.max_withdraw_usd || 10)));
  }
  window.PGEM.loadBalance = loadBalance;

  async function signUp(email, password, refCode) {
    if (!sb) { toast("Sign-up is not available yet — the site is still being set up.", false); return { error: "not_configured" }; }
    const fp = await deviceFingerprint();
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { device_fingerprint: fp, ref_code: refCode || null, site: "game" } },
    });
    if (error) return { error: error.message };
    // Referral is applied server-side via RPC after the profile exists.
    // With email confirmation ON, signUp returns no session yet, so the
    // RPC (authenticated-only) fails — keep the code and apply it on the
    // next successful sign-in (see refreshSession below).
    if (refCode && data.user) {
      const { error: refErr } = await sb.rpc("apply_referral", { p_user_id: data.user.id, p_code: refCode });
      if (refErr) { try { localStorage.setItem("pgem_pending_ref", refCode); } catch (e) {} }
    }
    return { data };
  }

  async function signIn(email, password) {
    if (!sb) { toast("Sign-in is not available yet — the site is still being set up.", false); return { error: "not_configured" }; }
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    await refreshSession();
    return { data };
  }

  async function signOut() {
    if (sb) await sb.auth.signOut();
    window.PGEM.user = null; window.PGEM.profile = null; window.PGEM.balance = null;
    window.location.href = "index.html";
  }

  async function requireAuth() {
    const u = await refreshSession();
    if (!u) { window.location.href = "login.html?next=" + encodeURIComponent(location.pathname.split("/").pop() || "earn.html"); return null; }
    return u;
  }
  window.PGEM.requireAuth = requireAuth;

  // --- Edge Function caller ----------------------------------------------------
  async function callFn(name, body) {
    if (!sb) return { error: "not_configured" };
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(CFG.supabase.functionsUrl + "/" + name, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: CFG.supabase.anonKey,
        Authorization: "Bearer " + (session ? session.access_token : CFG.supabase.anonKey),
      },
      body: JSON.stringify(body || {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: json.error || ("http_" + res.status), detail: json };
    return json;
  }
  window.PGEM.callFn = callFn;

  // --- Header / nav (rendered by JS so all pages stay in sync) ----------------
  function renderHeader() {
    const host = $("#site-header");
    if (!host) return;
    const u = window.PGEM.user;
    const b = window.PGEM.balance;
    host.innerHTML = `
    <header class="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div class="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
        <a href="index.html" class="flex items-center gap-2 font-extrabold text-lg tracking-tight">
          <span class="w-8 h-8 rounded-lg bg-violet-600 text-white grid place-items-center text-base">P</span>
          <span class="hidden sm:inline">PlayGames<span class="text-violet-600">EarnMoney</span></span>
          <span class="sm:hidden">PlayEarn</span>
        </a>
        <nav class="hidden md:flex items-center gap-4 text-sm font-medium text-slate-600">
          <a class="hover:text-violet-600" href="earn.html">Earn</a>
          <a class="hover:text-violet-600" href="surveys.html">Surveys</a>
          <a class="hover:text-violet-600" href="music.html">Music</a>
          <a class="hover:text-violet-600" href="cashback.html">Cashback</a>
          <a class="hover:text-violet-600" href="videos.html">Videos</a>
          <a class="hover:text-violet-600" href="proof.html">Payouts</a>
          <a class="hover:text-violet-600" href="referrals.html">Referrals</a>
        </nav>
        <div class="ml-auto flex items-center gap-2">
          ${!sessionReady ? `
            <span class="text-sm text-slate-400 px-3 py-1.5">…</span>`
          : u ? `
            <a href="wallet.html" class="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-full px-3 py-1.5 text-sm font-semibold text-violet-700">
              <span>🪙</span><span data-balance-coins>${b ? fmtCoins(b.available_coins) : "…"}</span>
              <span class="text-violet-400 font-normal">($<span data-balance-usd>${b ? coinsToUsd(b.available_coins) : "…"}</span>)</span>
            </a>
            <a href="wallet.html" class="hidden sm:inline text-sm font-medium text-slate-600 hover:text-violet-600">Wallet</a>
            <button data-action="signout" class="text-sm font-medium text-slate-500 hover:text-red-600">Log out</button>`
          : `<a href="login.html" class="text-sm font-semibold text-violet-600 hover:text-violet-700">Log in</a>
             <a href="login.html?mode=signup" class="text-sm font-semibold bg-violet-600 text-white px-3 py-1.5 rounded-full hover:bg-violet-700">Sign up free</a>`}
          <button class="md:hidden text-slate-600" data-action="menu" aria-label="Menu">☰</button>
        </div>
      </div>
      <div id="mobile-nav" class="hidden md:hidden border-t border-slate-100 px-4 py-2 flex flex-col gap-2 text-sm font-medium text-slate-600">
        <a href="earn.html">Earn</a><a href="surveys.html">Surveys</a><a href="music.html">Music</a>
        <a href="cashback.html">Cashback</a><a href="videos.html">Videos</a><a href="proof.html">Payouts</a>
        <a href="referrals.html">Referrals</a><a href="wallet.html">Wallet</a>
      </div>
    </header>`;
    $$("[data-action='signout']", host).forEach((b) => b.addEventListener("click", signOut));
    $$("[data-action='menu']", host).forEach((b) => b.addEventListener("click", () => {
      const m = $("#mobile-nav"); if (m) m.classList.toggle("hidden");
    }));
  }

  function renderAuthArea() { renderHeader(); }

  function renderFooter() {
    const host = $("#site-footer");
    if (!host) return;
    host.innerHTML = `
    <footer class="border-t border-slate-200 mt-16 bg-slate-50">
      <div class="max-w-6xl mx-auto px-4 py-8 grid sm:grid-cols-3 gap-6 text-sm text-slate-600">
        <div>
          <p class="font-bold text-slate-900">PlayGamesEarnMoney</p>
          <p class="mt-1">Play games, finish offers, earn real money. Coins convert at 1,000 coins = $1. Withdrawals are paid in batches — no hype, no fake promises.</p>
        </div>
        <div>
          <p class="font-bold text-slate-900">Earn</p>
          <p class="mt-1 flex flex-col gap-1">
            <a class="hover:text-violet-600" href="earn.html">Game offers</a>
            <a class="hover:text-violet-600" href="surveys.html">Paid surveys</a>
            <a class="hover:text-violet-600" href="cashback.html">Cashback shopping</a>
            <a class="hover:text-violet-600" href="videos.html">Rewarded videos</a>
          </p>
        </div>
        <div>
          <p class="font-bold text-slate-900">Company</p>
          <p class="mt-1 flex flex-col gap-1">
            <a class="hover:text-violet-600" href="about.html">About</a>
            <a class="hover:text-violet-600" href="terms.html">Terms of Service</a>
            <a class="hover:text-violet-600" href="privacy.html">Privacy Policy</a>
            <a class="hover:text-violet-600" href="contact.html">Contact</a>
          </p>
          <p class="mt-3 text-xs text-slate-400">18+ only. One account per person. No bots, VPNs or multi-accounting.</p>
        </div>
      </div>
    </footer>`;
  }

  // --- Ads loader ---------------------------------------------------------------
  // Injects a network tag ONLY when its id is filled in config. Ads live
  // only in slots the page explicitly provides (data-ad-slot) — never
  // inside the offerwall, survey iframes, or the withdrawal flow.
  function loadAds() {
    const A = CFG.ads;
    // Infolinks (in-text + in-fold) — page-level, no slot needed.
    if (A.infolinks.pid && A.infolinks.wsid) {
      window.infolinks_pid = Number(A.infolinks.pid);
      window.infolinks_wsid = Number(A.infolinks.wsid);
      injectScript("//resources.infolinks.com/js/infolinks_main.js");
    }
    // Monetag in-page push (MultiTag).
    if (A.monetag.tagUrl && A.monetag.zoneId) {
      const s = injectScript(A.monetag.tagUrl);
      s.setAttribute("data-zone", A.monetag.zoneId);
    }
    // Adsterra banners: fill [data-ad-slot="adsterra-banner"] slots.
    if (A.adsterra.bannerKey) {
      $$('[data-ad-slot="adsterra-banner"]').forEach((slot, i) => {
        const key = A.adsterra.bannerKey;
        slot.innerHTML = "";
        const d = document.createElement("div");
        d.id = "container-" + key + (i ? "-" + i : "");
        slot.appendChild(d);
        injectScript("//pl" + key + ".profitablecpmrate.com/" + key + "/invoke.js");
      });
    }
    // Adsterra native.
    if (A.adsterra.nativeKey) {
      $$('[data-ad-slot="adsterra-native"]').forEach((slot) => {
        slot.innerHTML = "";
        const d = document.createElement("div");
        d.id = "container-" + A.adsterra.nativeKey;
        slot.appendChild(d);
        injectScript("//pl" + A.adsterra.nativeKey + ".profitablecpmrate.com/" + A.adsterra.nativeKey + "/invoke.js");
      });
    }
    // Generic tag-based networks: config holds the dashboard tag URL.
    const generic = [
      ["adcash", A.adcash], ["hilltopads", A.hilltopads], ["clickadu", A.clickadu],
      ["richads", A.richads], ["evadav", A.evadav], ["mondiad", A.mondiad],
    ];
    generic.forEach(([name, net]) => {
      const zone = net.zoneId || net.widgetId;
      if (net.tagUrl && zone) {
        $$('[data-ad-slot="' + name + '"]').forEach((slot) => {
          slot.innerHTML = "";
          const s = injectScript(net.tagUrl);
          s.setAttribute("data-zone", zone);
          slot.appendChild(document.createComment("ad:" + name));
        });
      }
    });
    // Media.net contextual.
    if (A.medianet.cid && A.medianet.crid) {
      $$('[data-ad-slot="medianet"]').forEach((slot) => {
        slot.innerHTML = "";
        const d = document.createElement("div");
        d.id = "medianet-" + A.medianet.crid;
        slot.appendChild(d);
        window.medianet_width = "728"; window.medianet_height = "90";
        window.medianet_crid = A.medianet.crid; window.medianet_versionId = "111299";
        injectScript("//contextual.media.net/dmedianet.js?cid=" + A.medianet.cid);
      });
    }
    // Sticky bottom anchor banner (Adsterra banner slot, dismissible).
    const anchor = $("#anchor-banner");
    if (anchor && A.adsterra.bannerKey) {
      const inner = anchor.querySelector('[data-ad-slot="adsterra-banner"]');
      if (inner) {
        const d = document.createElement("div");
        d.id = "container-" + A.adsterra.bannerKey + "-anchor";
        inner.appendChild(d);
        injectScript("//pl" + A.adsterra.bannerKey + ".profitablecpmrate.com/" + A.adsterra.bannerKey + "/invoke.js");
      }
      anchor.classList.remove("hidden");
      const close = anchor.querySelector("[data-action='close-anchor']");
      if (close) close.addEventListener("click", () => anchor.remove());
    }
  }
  function injectScript(src) {
    const s = document.createElement("script");
    s.async = true; s.setAttribute("data-cfasync", "false"); s.src = src;
    document.head.appendChild(s);
    return s;
  }
  window.PGEM.loadAds = loadAds;

  // --- Push notifications (Monetag, opt-in only) --------------------------------
  function maybeAskPush() {
    const P = CFG.push;
    if (!P.tagUrl || !P.zoneId) return; // no provider connected yet
    try {
      const dismissed = localStorage.getItem("pgem_push_dismissed_at");
      if (dismissed && Date.now() - Number(dismissed) < P.remindAfterDays * 86400000) return;
      if (localStorage.getItem("pgem_push_enabled")) { loadPushTag(); return; }
    } catch (e) { /* storage unavailable */ }
    const bar = $("#push-optin");
    if (!bar) return;
    bar.classList.remove("hidden");
    const allow = bar.querySelector("[data-action='push-allow']");
    const deny = bar.querySelector("[data-action='push-deny']");
    if (allow) allow.addEventListener("click", () => {
      try { localStorage.setItem("pgem_push_enabled", "1"); } catch (e) {}
      bar.remove(); loadPushTag();
      toast("Notifications enabled. You can turn them off anytime in your browser settings.");
    });
    if (deny) deny.addEventListener("click", () => {
      try { localStorage.setItem("pgem_push_dismissed_at", String(Date.now())); } catch (e) {}
      bar.remove();
    });
  }
  function loadPushTag() {
    const P = CFG.push;
    if (!P.tagUrl) return;
    const s = injectScript(P.tagUrl);
    s.setAttribute("data-zone", P.zoneId);
  }
  window.PGEM.maybeAskPush = maybeAskPush;

  // --- Daily check-in -------------------------------------------------------------
  // Server-side via the claim_checkin RPC (SECURITY DEFINER): one row per
  // user per day, streak-aware, amounts locked server-side. The client
  // NEVER writes to the ledger directly.
  async function doCheckin() {
    if (!sb) { toast("Check-in needs an account — please log in first.", false); return null; }
    if (!window.PGEM.user) { toast("Please log in first.", false); return null; }
    let r;
    try {
      const res = await sb.rpc("claim_checkin", { p_site: "game" });
      if (res.error) { toast("Check-in failed: " + res.error.message, false); return null; }
      r = res.data;
    } catch (e) {
      toast("Check-in failed: " + (e && e.message ? e.message : "network error"), false);
      return null;
    }
    if (r && r.already) {
      toast("Already checked in today — come back tomorrow! (streak " + (r.streak || 1) + " days)");
    } else {
      toast("Checked in! +" + (r ? r.coins : 0) + " coins (streak " + (r ? r.streak : 1) + " days).");
    }
    await loadBalance();
    await refreshCheckinState();
    return r;
  }
  window.PGEM.doCheckin = doCheckin;

  // Grey out the check-in button when today is already claimed, so the
  // page never shows a live "Check in" button next to an "already done"
  // message. Runs after the session is known.
  async function refreshCheckinState() {
    const btn = $("#checkin-btn");
    if (!btn || !sb || !window.PGEM.user) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await sb.from("daily_checkins")
      .select("coins_awarded, streak").eq("user_id", window.PGEM.user.id)
      .eq("checkin_date", today).maybeSingle();
    if (data) {
      btn.disabled = true;
      btn.textContent = "Checked in ✓ +" + data.coins_awarded + " coins";
    } else {
      // Round-2 (bug 3): never promise a fixed amount on the button — the
      // credited amount depends on which site claims first and on the
      // streak (game: 50 + 10/streak-day, cap 100). The toast after a
      // successful claim shows the real amount.
      btn.disabled = false;
      btn.textContent = "Check in today 🪙";
    }
  }
  window.PGEM.refreshCheckinState = refreshCheckinState;

  // --- Boot -----------------------------------------------------------------------
  // Session FIRST, header second: the header must never show the logged-out
  // links to a logged-in user (or vice versa) while the session loads.
  document.addEventListener("DOMContentLoaded", async () => {
    // Safety net: if the session check hangs (CDN down), show guest
    // content after 6s instead of leaving auth-gated content hidden
    // forever. Normal loads resolve the session well before this fires.
    setTimeout(() => document.body.classList.add("auth-ready"), 6000);
    renderHeader(); // loading state ("…") until the session is known
    renderFooter();
    await refreshSession();
    if (window.PGEM.user) await refreshCheckinState();
    loadAds();
    maybeAskPush();
    const btn = $("#checkin-btn");
    if (btn) btn.addEventListener("click", doCheckin);
  });

  // Expose auth helpers for page scripts.
  window.PGEM.signUp = signUp;
  window.PGEM.signIn = signIn;
  window.PGEM.signOut = signOut;
  window.PGEM.refreshSession = refreshSession;
})();
