// login.html — sign in / sign up. Referral code is read from ?ref=.
// Turnstile renders only when a site key is configured.
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  let mode = "login";

  function setMode(m) {
    mode = m;
    $("#tab-login").classList.toggle("active", m === "login");
    $("#tab-signup").classList.toggle("active", m === "signup");
    $("#form-title").textContent = m === "login" ? "Welcome back!" : "Create your free account";
    $("#form-sub").textContent = m === "login" ? "Log in to your coins." : "Free to join. Start earning in minutes.";
    $("#auth-submit").textContent = m === "login" ? "Log in →" : "Sign up & start earning →";
    $("#ref-row").classList.toggle("hidden", m !== "signup");
    $("#password").setAttribute("autocomplete", m === "login" ? "current-password" : "new-password");
  }

  document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(location.search);
    const ref = params.get("ref");
    if (ref) {
      $("#refcode").value = ref;
      const n = $("#ref-note");
      n.textContent = "You were invited! Sign up with code " + ref + " — your friend earns 10% of your earnings (from our share, never yours).";
      n.classList.remove("hidden");
    }
    const next = params.get("next") || "earn.html";
    // BUG FIX (23/11): a signed-in user clicking a "Start earning" CTA
    // landed on this login form instead of earning. If a session already
    // exists, skip the form and go straight to the destination.
    if (window.PGEM && window.PGEM.refreshSession) {
      window.PGEM.refreshSession().then((u) => { if (u) window.location.href = next; }).catch(() => {});
    }
    setMode(params.get("mode") === "signup" ? "signup" : "login");
    $("#tab-login").addEventListener("click", () => setMode("login"));
    $("#tab-signup").addEventListener("click", () => setMode("signup"));

    // Turnstile (only when configured).
    const key = window.PGEM_CONFIG.turnstileSiteKey;
    if (key) {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true;
      document.head.appendChild(s);
      const host = $("#turnstile-host");
      host.innerHTML = '<div class="cf-turnstile" data-sitekey="' + key + '"></div>';
    }

    $("#auth-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#auth-error");
      err.classList.add("hidden");
      const email = $("#email").value.trim();
      const password = $("#password").value;
      const btn = $("#auth-submit");
      btn.disabled = true;
      btn.textContent = "Please wait…";
      let r;
      if (mode === "login") {
        r = await window.PGEM.signIn(email, password);
      } else {
        r = await window.PGEM.signUp(email, password, $("#refcode").value.trim() || null);
      }
      btn.disabled = false;
      btn.textContent = mode === "login" ? "Log in →" : "Sign up & start earning →";
      if (r.error) {
        err.textContent = typeof r.error === "string" ? r.error : "Something went wrong. Please try again.";
        err.classList.remove("hidden");
        return;
      }
      if (mode === "signup") {
        window.PGEM.toast("Account created! Check your email to confirm, then log in.");
        setMode("login");
        return;
      }
      window.location.href = next;
    });
  });
})();
