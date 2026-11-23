// surveys.html — CPX Research + TheoremReach routers.
// CPX iframe URL is signed SERVER-SIDE (secure_hash needs the app secret),
// so the page asks the edge function for a signed URL instead of building
// it in the browser. TheoremReach opens its router entry link in a new tab.
(function () {
  "use strict";
  const CFG = window.PGEM_CONFIG;
  const $ = (s) => document.querySelector(s);

  function pendingMsg(host, title, text) {
    host.innerHTML = `<div class="border border-dashed border-slate-300 rounded-xl p-4 text-center text-sm text-slate-500">
      <p class="font-semibold text-slate-700">${title}</p><p class="mt-1">${text}</p></div>`;
  }

  async function init() {
    const user = await window.PGEM.requireAuth();
    if (!user) return;

    // --- CPX Research ---
    const cpxBtn = $("#cpx-open");
    cpxBtn.addEventListener("click", async () => {
      if (!CFG.cpx.appId) {
        pendingMsg($("#cpx-host"), "CPX Research is being connected",
          "The CPX publisher account is being set up. Try TheoremReach or the offer wall meanwhile.");
        return;
      }
      cpxBtn.disabled = true; cpxBtn.textContent = "Loading CPX…";
      // ROOT-CAUSE FIX (23/11): callFn used to throw on network/CORS
      // failure and this handler had no catch, so the button stayed
      // disabled on "Loading CPX…" forever. callFn now returns
      // { error } instead of throwing, but the try/catch stays as a
      // second layer — the button MUST reset on every path.
      let r;
      try {
        r = await window.PGEM.callFn("survey-url", { router: "cpx" });
      } catch (e) {
        r = { error: "network_error" };
      }
      if (!r || r.error || !r.url) {
        window.PGEM.toast("Could not open CPX right now: " + (r.error || "unknown error"), false);
        cpxBtn.disabled = false; cpxBtn.textContent = "Open CPX surveys →";
        return;
      }
      const host = $("#cpx-frame-host");
      host.innerHTML = "";
      const f = document.createElement("iframe");
      f.src = r.url; f.style.width = "100%"; f.style.height = "2000px";
      f.style.border = "0"; f.setAttribute("title", "CPX Research surveys");
      host.appendChild(f);
      host.scrollIntoView({ behavior: "smooth" });
      cpxBtn.textContent = "CPX surveys open below ↓";
    });

    // --- TheoremReach ---
    const trBtn = $("#tr-open");
    trBtn.addEventListener("click", async () => {
      if (!CFG.theoremreach || !CFG.theoremreach.apiKey) {
        pendingMsg($("#tr-host"), "TheoremReach is being connected",
          "The TheoremReach publisher account is being set up. Try CPX or the offer wall meanwhile.");
        return;
      }
      // BUG FIX (23/11): window.open() AFTER an await loses the click's
      // user gesture, so the popup blocker silently ate the new tab —
      // three clicks, no tab, no error, no message. (CPX worked because
      // it injects an iframe in-page, never a popup.) Open the tab
      // synchronously first, then point it at the router URL once the
      // edge function returns it.
      //
      // BUG FIX 2 (23/11, re-test #3): the open call MUST NOT use
      // "noopener" — WebKit-based browsers return null for
      // window.open(..., "noopener") while STILL opening the blank tab,
      // so the code below fell into the same-tab fallback and navigated
      // the ORIGINAL surveys tab to the router, orphaning the blank tab.
      // Without noopener every browser returns a real reference to the
      // new tab, so exactly one tab opens and THAT tab gets the router.
      trBtn.disabled = true; trBtn.textContent = "Loading TheoremReach…";
      const win = window.open("about:blank", "_blank");
      // ROOT-CAUSE FIX (23/11): callFn used to throw on network/CORS
      // failure and this handler had no catch, so a throw left the
      // button disabled on "Loading…" forever and the blank tab
      // orphaned. callFn now returns { error } instead of throwing,
      // but the try/catch stays as a second layer — on ANY failure
      // the blank tab is closed and the button resets.
      let r;
      try {
        r = await window.PGEM.callFn("survey-url", { router: "theoremreach" });
      } catch (e) {
        r = { error: "network_error" };
      }
      if (!r || r.error || !r.url) {
        if (win) win.close();
        window.PGEM.toast("Could not open TheoremReach right now: " + ((r && r.error) || "unknown error"), false);
        trBtn.disabled = false; trBtn.textContent = "Open TheoremReach surveys →";
        return;
      }
      if (win) win.location.href = r.url;
      else window.location.href = r.url; // popup blocked outright — same-tab fallback
      trBtn.disabled = false; trBtn.textContent = "Open TheoremReach surveys →";
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
