// ============================================================================
// PlayGamesEarnMoney — Site #1 (game-led GPT site)
// CENTRAL CONFIG — every integration lives here. Anything marked
// "pending-account" needs a dashboard signup (see README.md) before it
// goes live; the site runs fine with it off (no broken tags, no errors).
//
// Coin economy (LOCKED — do not change without the owner's order):
//   1,000 coins = $1 | user gets 60% of offerwall value | site keeps 40%
//   Withdrawal: $10 PayPal / $3 crypto (LTC/USDT)
//   NO "first $10 in 1 hour" promise anywhere. Payouts are gradual:
//   levels + batch payouts 2x/week (Tue/Fri) + first-withdrawal hold.
// ============================================================================

window.PGEM_CONFIG = {
  site: {
    name: "PlayGamesEarnMoney",
    shortName: "PlayEarn",
    domain: "playgamesearnmoney.com",
    baseUrl: "https://playgamesearnmoney.com",
    tagline: "Play games, finish offers, earn real money.",
    supportEmail: "support@playgamesearnmoney.com",
    // Clone-ready: sites #2/#3 reuse this codebase with a different
    // brand + featuredCategory (surveys / trials) in this block.
    brand: "game",               // game | surveys | trials
    featuredCategory: "games",   // games | surveys | trials
    accent: "#7c3aed",           // violet — game-led brand
  },

  // --- Supabase backend (REQUIRED before auth/balances work) ---------------
  // Fill after creating the project (see README.md "Backend setup").
  // A NEW Supabase project is recommended (isolation from CongCuShop).
  supabase: {
    url: "https://hqkjcwjqxhbhenvanteu.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxa2pjd2pxeGhiaGVudmFudGV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzODUxMjEsImV4cCI6MjExMDk2MTEyMX0.y_J73wKX30ZSkB6iXtLpm5dvB3P_jpbHJOQzdC4rbGY",
    functionsUrl: "https://hqkjcwjqxhbhenvanteu.supabase.co/functions/v1",
  },

  // --- Anti-fraud (Turnstile) ----------------------------------------------
  // Cloudflare Turnstile site key. Leave "" to skip the widget (forms still
  // work; enable before launch — it is the day-1 fraud layer).
  turnstileSiteKey: "",

  // --- Coin economy (LOCKED) -----------------------------------------------
  coins: {
    perDollar: 1000,          // 1,000 coins = $1
    userShare: 0.60,          // user gets 60% of offerwall USD value
    siteShare: 0.40,
    // Offerwall.GG placement rate: 600 coins per $1 of site earnings
    // (= 60% user share). Set this exact number in the Offerwall.GG
    // dashboard when creating the placement.
    offerwallGgCoinsPerDollar: 600,
    minWithdrawPaypalUsd: 10,
    minWithdrawCryptoUsd: 3,
    signupBonusCoins: 250,    // $0.25 — LOCKED until first offer completes
    checkinBaseCoins: 50,     // daily check-in base
    checkinStreakBonus: 10,   // +10 per consecutive day, cap below
    checkinMaxCoins: 100,
    musicCoinsPerSession: 5,  // music zone: 5 coins / 15 min, cap below
    musicDailyCapCoins: 20,
    referralRate: 0.10,       // referrer earns 10% of referral's offer earnings
    firstWithdrawHoldHours: 48,
    // Levels: [minLifetimeEarnedUsd, minOffersCompleted, maxWithdrawUsd]
    levels: [
      { level: 1, name: "Rookie",   minEarnedUsd: 0,  minOffers: 0,  maxWithdrawUsd: 10 },
      { level: 2, name: "Player",   minEarnedUsd: 10, minOffers: 5,  maxWithdrawUsd: 25 },
      { level: 3, name: "Pro",      minEarnedUsd: 50, minOffers: 20, maxWithdrawUsd: 50 },
    ],
    dailyPayoutCapUsd: 500,   // total payouts per batch day (admin can raise)
    payoutBatchDays: [2, 5],  // Tue + Fri (0=Sun). Batches processed by admin.
  },

  // --- Offerwalls ------------------------------------------------------------
  // Offerwall.GG: iframe https://offerwall.gg/wall/YOUR_KEY?userId={userId}
  //   Postback: GET {SUPABASE_URL}/functions/v1/offerwall-postback?network=offerwall_gg
  //   with params user, tx, amount, sig = HMAC-SHA256("user:tx:amount", SECRET)
  //   Set placement rate = 600 coins per $1 (see coins above).
  //   Site verification: meta tag / file / DNS — see README.md.
  offerwallGg: {
    status: "pending-account",
    placementKey: "5cdd431f1439b328ed3d0da1e0990f2a", // YOUR_KEY from the Offerwall.GG dashboard
    postbackSecretEnv: "OFFERWALL_GG_SECRET", // Supabase secret name
  },
  // AdGem: Web Offerwall URL comes from the dashboard per Property.
  //   Postback v3: POST JSON to .../offerwall-postback?network=adgem
  //   with `Signature` header = HMAC-SHA256(raw body, POSTBACK_KEY).
  //   AdGem sends `amount` = coins to reward (set the multiplier in the
  //   dashboard so the user gets 60%: amount = payout_usd * 600).
  //   `payout` field = USD revenue (stored for reporting).
  adgem: {
    status: "pending-account",
    wallUrl: "",                // paste the Web Offerwall URL from dashboard
    postbackKeyEnv: "ADGEM_POSTBACK_KEY",
  },

  // --- Extra survey routers --------------------------------------------------
  // CPX Research: iframe
  //   https://offers.cpx-research.com/index.php?app_id={APP_ID}
  //     &ext_user_id={userId}&secure_hash={md5(userId + "-" + APP_SECURE_HASH)}
  //     &username={name}&email={email}
  //   Postback URL is set in the CPX dashboard (Postback Settings tab).
  //   CPX postback sends the USD payout; the edge function converts at
  //   600 coins per $1 (60% user share).
  cpx: {
    status: "pending-account",
    appId: "",
    // APP_SECURE_HASH is used ONLY server-side to build secure_hash.
    // The iframe URL is built by the edge function, never in the browser.
    useServerSignedUrl: true,
  },
  // TheoremReach: router entry link
  //   https://theoremreach.com/respondent_entry/router
  //     ?api_key={API_KEY}&user_id={userId}&transaction_id={txId}
  //   S2S reward callback is set in the TheoremReach dashboard
  //   (publishers.theoremreach.com) — HMAC-secured, same edge function.
  theoremreach: {
    status: "pending-account",
    apiKey: "d1468fd504854886df26440df7ce",                 // publishable key for the entry link
    // Secret key stays server-side (Supabase secret THEOREMREACH_SECRET).
  },

  // --- Display ad networks (ALL 11 — safe formats only) ---------------------
  // RULES (non-negotiable, from the research): never reward users for
  // viewing/clicking ads; never put an ad inside the offerwall, a survey
  // iframe, or the withdrawal flow; ads live only in sidebar/content
  // slots and the dismissible bottom anchor banner.
  // Each entry: status "pending-account" until the dashboard tag is pasted.
  // The loader (loadAds in js/core.js) injects a tag ONLY when its id is filled in.
  ads: {
    // --- LIVE AT LAUNCH (Phase 1) ---
    infolinks: {
      status: "pending-account", format: "in-text + in-fold",
      pid: "", wsid: "",
      note: "Stacks on everything without taking a slot. $1–$3 RPM.",
    },
    monetag: {
      status: "pending-account", format: "in-page push only (frequency-capped)",
      tagUrl: "", zoneId: "",
      note: "MultiTag script URL + zone id come from the Monetag dashboard.",
    },
    adsterra: {
      status: "pending-account", format: "native + display banners only",
      bannerKey: "", nativeKey: "",
      note: "Banner invoke.js key + native key from the Adsterra dashboard.",
    },
    // --- REGISTERED, TAGS ENABLED WITH THE REST (all-streams order) ---
    adcash: {
      status: "pending-account", format: "display + native + in-page push",
      zoneId: "", tagUrl: "",
      note: "Autotag/display tag from the Adcash dashboard. No popunder.",
    },
    hilltopads: {
      status: "pending-account", format: "banner + in-page push + video",
      zoneId: "", tagUrl: "",
      note: "Zone id + tag from the HilltopAds dashboard. No popunder.",
    },
    clickadu: {
      status: "pending-account", format: "banner + in-page push + video pre-roll",
      zoneId: "", tagUrl: "",
      note: "Zone id + tag from the Clickadu dashboard. No popunder/SKIM.",
    },
    richads: {
      status: "pending-account", format: "native + in-page push + pre-roll video",
      zoneId: "", tagUrl: "",
      note: "Zone id + tag from the RichAds dashboard. No push/popunder.",
    },
    evadav: {
      status: "pending-account", format: "native + banner + in-page push",
      widgetId: "", tagUrl: "",
      note: "Widget id + tag from the Evadav dashboard. No push/popunder.",
    },
    mondiad: {
      status: "pending-account", format: "native + banner",
      zoneId: "", tagUrl: "",
      note: "Zone id + tag from the Mondiad dashboard. No popunder/push.",
    },
    medianet: {
      status: "pending-account", format: "contextual display + native",
      cid: "", crid: "",
      note: "By-contact approval (2–5 days+). cid + crid from Media.net.",
    },
    // PopAds is popunder-ONLY — it has no safe format, so it is EXCLUDED
    // by the no-popunder rule. It is not "pending"; it is deliberately out.
    popads: {
      status: "excluded",
      reason: "Popunder-only network — no safe format exists. Excluded by the no-popunder rule (user order).",
    },
  },

  // --- Cashback shopping (Phase 2 — now installed) ---------------------------
  // Affiliate programs pay 5–10% commission; part is shared with the user
  // as coins. Stores are config-driven; the list starts EMPTY (honest
  // "coming soon" state) until real affiliate deals are signed — never
  // show fake deals. Join: Rakuten Advertising, Impact, Awin, ShareASale.
  cashback: {
    status: "code-ready",
    userShareOfCommission: 0.5, // user gets 50% of the affiliate commission as coins
    stores: [
      // { name: "Example Store", url: "https://...", commissionPct: 5, category: "Fashion" }
    ],
  },

  // --- Rewarded video (Phase 2 — now installed) ------------------------------
  // Web rewarded video via Monetag rewarded interstitial (placeholder zone).
  // Credit ONLY comes from the network's server callback — the claim
  // endpoint rejects client-only claims until a provider is connected.
  rewardedVideo: {
    status: "code-ready",
    provider: "monetag",
    zoneId: "",
    coinsPerView: 10,       // 10 coins per completed rewarded view
    maxViewsPerDay: 10,
    cooldownMinutes: 10,
  },

  // --- Monetag push notifications (Phase 2 — now installed) ------------------
  // Opt-in ONLY. The tag loads only after the user clicks "Allow".
  push: {
    status: "code-ready",
    provider: "monetag",
    tagUrl: "", zoneId: "",
    remindAfterDays: 7,     // don't re-ask for 7 days after a decline
  },

  // --- Payout proof wall -----------------------------------------------------
  // Shows ONLY real paid withdrawals (from the DB). Never fake proofs.
  proofWall: { enabled: true, maxItems: 20 },
};

// Helper: is the Supabase backend configured yet?
window.PGEM_CONFIG.isBackendConfigured = function () {
  const s = window.PGEM_CONFIG.supabase;
  return s.url.indexOf("YOUR-PROJECT") === -1 && s.anonKey.indexOf("YOUR-") === -1;
};
