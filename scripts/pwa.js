const CONSENT_KEY = "brick-bun-cookie-consent";
const INSTALL_DISMISSED_KEY = "brick-bun-install-dismissed";
let deferredInstallPrompt = null;

const isInstalled = () => window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

function injectPwaStyles() {
  if (document.getElementById("brick-bun-pwa-ui-styles")) return;
  const style = document.createElement("style");
  style.id = "brick-bun-pwa-ui-styles";
  style.textContent = `
    .bb-pwa-overlay{position:fixed;inset:0;z-index:10000;background:rgba(25,23,20,.48);display:grid;place-items:center;padding:20px;box-sizing:border-box;backdrop-filter:blur(4px)}
    .bb-pwa-modal,.bb-cookie-banner{font-family:Arial,Helvetica,sans-serif;color:#292824;background:#fff;border:1px solid rgba(41,40,36,.12);box-shadow:0 24px 80px rgba(0,0,0,.24)}
    .bb-pwa-modal{width:min(430px,100%);border-radius:18px;padding:24px;box-sizing:border-box;text-align:center}
    .bb-pwa-modal h2{margin:0 0 8px;font-size:1.35rem}.bb-pwa-modal p{margin:0;color:#69665f;line-height:1.55;font-size:.92rem}
    .bb-pwa-app-icon{width:72px;height:72px;border-radius:17px;box-shadow:0 10px 30px rgba(196,90,60,.22);margin-bottom:16px}
    .bb-pwa-actions{display:flex;gap:10px;margin-top:20px}.bb-pwa-actions button,.bb-cookie-banner button{border:0;border-radius:9px;padding:11px 16px;font-weight:700;cursor:pointer;font:inherit}
    .bb-pwa-primary{flex:1;background:#c45a3c;color:#fff}.bb-pwa-secondary{background:#eeeae3;color:#292824}.bb-pwa-actions .bb-pwa-secondary{flex:1}
    .bb-pwa-progress-wrap{height:10px;background:#eeeae3;border-radius:999px;overflow:hidden;margin:20px 0 8px}.bb-pwa-progress{height:100%;width:0;background:#c45a3c;transition:width .25s ease}.bb-pwa-progress-label{display:flex;justify-content:space-between;gap:12px;font-size:.78rem;color:#69665f}.bb-pwa-file{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px}
    .bb-cookie-banner{position:fixed;left:18px;right:18px;bottom:18px;z-index:9999;width:min(680px,calc(100% - 36px));margin:auto;border-radius:14px;padding:18px;box-sizing:border-box}
    .bb-cookie-banner strong{display:block;margin-bottom:5px}.bb-cookie-banner p{margin:0;color:#69665f;font-size:.88rem;line-height:1.45}.bb-cookie-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.bb-cookie-actions button:first-child{background:#c45a3c;color:#fff}.bb-cookie-actions button:last-child{background:#eeeae3;color:#292824}
    @media(max-width:520px){.bb-pwa-actions,.bb-cookie-actions{flex-direction:column}.bb-cookie-banner{left:10px;right:10px;width:auto;bottom:10px}.bb-cookie-actions button,.bb-pwa-actions button{width:100%}}
  `;
  document.head.appendChild(style);
}

function removeCookieBanner() {
  document.getElementById("brick-bun-cookie-banner")?.remove();
}

function showCookieConsent() {
  if (localStorage.getItem(CONSENT_KEY) || document.getElementById("brick-bun-cookie-banner")) return;
  injectPwaStyles();
  const banner = document.createElement("section");
  banner.id = "brick-bun-cookie-banner";
  banner.className = "bb-cookie-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", "Cookie consent");
  banner.innerHTML = `
    <strong>Your privacy choices</strong>
    <p>We use essential storage to keep your preferences and offline app working. Optional cookies are only used with your permission.</p>
    <div class="bb-cookie-actions">
      <button type="button" data-choice="all">Accept all</button>
      <button type="button" data-choice="essential">Essential only</button>
    </div>`;
  banner.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: button.dataset.choice, date: new Date().toISOString() }));
    removeCookieBanner();
    window.setTimeout(() => showInstallPrompt(), 1800);
  }));
  document.body.appendChild(banner);
}

function requestInstallProgress() {
  navigator.serviceWorker.controller?.postMessage({ type: "BRICK_BUN_GET_CACHE_PROGRESS" });
}

function showInstallDownload() {
  injectPwaStyles();
  const existing = document.getElementById("brick-bun-install-download");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.id = "brick-bun-install-download";
  overlay.className = "bb-pwa-overlay";
  overlay.innerHTML = `
    <section class="bb-pwa-modal" role="dialog" aria-modal="true" aria-labelledby="bb-install-title">
      <img class="bb-pwa-app-icon" src="/assets/icons/icon-192.svg" alt="">
      <h2 id="bb-install-title">Preparing BRICK &amp; BUN</h2>
      <p>Downloading the app and its offline files. Keep this window open.</p>
      <div class="bb-pwa-progress-wrap"><div class="bb-pwa-progress" id="bb-install-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100"></div></div>
      <div class="bb-pwa-progress-label"><span class="bb-pwa-file" id="bb-install-file">Preparing offline files</span><strong id="bb-install-percent">0%</strong></div>
    </section>`;
  document.body.appendChild(overlay);
  requestInstallProgress();
}

function updateInstallProgress(data) {
  const bar = document.getElementById("bb-install-progress");
  if (!bar) return;
  bar.style.width = `${data.percent}%`;
  bar.setAttribute("aria-valuenow", String(data.percent));
  document.getElementById("bb-install-percent").textContent = `${data.percent}%`;
  document.getElementById("bb-install-file").textContent = data.file || "Offline files";
  if (data.percent >= 100) {
    document.querySelector("#brick-bun-install-download h2").textContent = "Ready to use offline";
    window.setTimeout(() => document.getElementById("brick-bun-install-download")?.remove(), 900);
  }
}

async function startInstall() {
  if (!deferredInstallPrompt) return;
  showInstallDownload();
  deferredInstallPrompt.prompt();
  const result = await deferredInstallPrompt.userChoice;
  if (result.outcome === "dismissed") {
    document.getElementById("brick-bun-install-download")?.remove();
    localStorage.setItem(INSTALL_DISMISSED_KEY, new Date().toISOString());
  }
  deferredInstallPrompt = null;
}

function showInstallPrompt() {
  if (isInstalled() || localStorage.getItem(INSTALL_DISMISSED_KEY) ||
      deferredInstallPrompt === null || document.getElementById("brick-bun-install-card")) return;
  injectPwaStyles();
  const overlay = document.createElement("div");
  overlay.id = "brick-bun-install-card";
  overlay.className = "bb-pwa-overlay";
  overlay.innerHTML = `
    <section class="bb-pwa-modal" role="dialog" aria-modal="true" aria-labelledby="bb-install-card-title">
      <img class="bb-pwa-app-icon" src="/assets/icons/icon-192.svg" alt="">
      <h2 id="bb-install-card-title">Install BRICK &amp; BUN</h2>
      <p>Get quicker access and keep the menu and ordering experience available offline.</p>
      <div class="bb-pwa-actions">
        <button class="bb-pwa-secondary" type="button" data-action="later">Not now</button>
        <button class="bb-pwa-primary" type="button" data-action="install">Install app</button>
      </div>
    </section>`;
  overlay.querySelector('[data-action="install"]').addEventListener("click", () => {
    overlay.remove();
    startInstall();
  });
  overlay.querySelector('[data-action="later"]').addEventListener("click", () => {
    overlay.remove();
    localStorage.setItem(INSTALL_DISMISSED_KEY, new Date().toISOString());
  });
  document.body.appendChild(overlay);
}

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .catch((error) => console.error("BRICK & BUN could not register offline support.", error));
  }, { once: true });

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "BRICK_BUN_REQUIRES_CONNECTION") {
      const pathname = location.pathname.replace(/\/$/, "") || "/";
      if (pathname !== "/offline" && pathname !== "/offline.html") location.replace("/offline.html");
    }
    if (event.data?.type === "BRICK_BUN_CACHE_PROGRESS") updateInstallProgress(event.data);
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  // Capture Chromium's native prompt and let the custom UI be the only install path.
  if (event.cancelable) event.preventDefault();
  deferredInstallPrompt = event;
  if (document.readyState === "complete") {
    window.setTimeout(showInstallPrompt, 4000);
  }
}, { capture: true });

window.addEventListener("load", () => {
  window.setTimeout(() => {
    if (!localStorage.getItem(CONSENT_KEY)) showCookieConsent();
    else if (!isInstalled()) window.setTimeout(showInstallPrompt, 4000);
  }, 2200);
}, { once: true });

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  localStorage.setItem(INSTALL_DISMISSED_KEY, new Date().toISOString());
  document.getElementById("brick-bun-install-card")?.remove();
  document.getElementById("brick-bun-install-download")?.remove();
});

const nativeFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  try {
    const response = await nativeFetch(...args);
    const requiresOfflinePage = response.headers.get("X-Brick-Bun-Offline") === "1" ||
      (response.status === 503 && response.headers.get("content-type")?.includes("text/html"));
    if (requiresOfflinePage && !["/offline", "/offline.html"].includes(location.pathname)) {
      location.replace("/offline.html");
    }
    return response;
  } catch (error) {
    if (!["/offline", "/offline.html"].includes(location.pathname)) location.replace("/offline.html");
    throw error;
  }
};
