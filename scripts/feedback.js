let feedbackOverlay;
let toast;
let dismissTimer;
let removeTimer;
let transitionOverlay;
let navigationTimer;

export function showFeedback(message, isError = false) {
  if (!message) return;

  if (!feedbackOverlay) {
    feedbackOverlay = document.createElement("div");
    feedbackOverlay.className = "app-feedback-overlay";
    feedbackOverlay.hidden = true;
    toast = document.createElement("div");
    toast.className = "app-feedback-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.setAttribute("aria-atomic", "true");
    feedbackOverlay.append(toast);
    document.body.append(feedbackOverlay);
  }

  window.clearTimeout(dismissTimer);
  window.clearTimeout(removeTimer);
  feedbackOverlay.hidden = false;
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.setAttribute("role", isError ? "alert" : "status");
  toast.setAttribute("aria-live", isError ? "assertive" : "polite");
  void feedbackOverlay.offsetWidth;
  feedbackOverlay.classList.add("is-visible");

  dismissTimer = window.setTimeout(() => {
    feedbackOverlay.classList.remove("is-visible");
    removeTimer = window.setTimeout(() => {
      toast.textContent = "";
      feedbackOverlay.hidden = true;
    }, 220);
  }, 3200);
}

function getTransitionOverlay() {
  if (transitionOverlay) return transitionOverlay;

  transitionOverlay = document.createElement("div");
  transitionOverlay.className = "page-transition-overlay";
  transitionOverlay.hidden = true;
  transitionOverlay.setAttribute("role", "status");
  transitionOverlay.setAttribute("aria-live", "polite");
  transitionOverlay.innerHTML = `
    <span class="page-transition-card">
      <span class="page-transition-spinner" aria-hidden="true"></span>
      <span>Taking you there...</span>
    </span>
  `;
  document.body.append(transitionOverlay);
  return transitionOverlay;
}

function hideNavigationTransition() {
  window.clearTimeout(navigationTimer);
  if (!transitionOverlay) return;
  transitionOverlay.classList.remove("is-visible");
  transitionOverlay.hidden = true;
}

export function navigateWithTransition(destination, replace = false) {
  const target = new URL(destination, window.location.href);
  const overlay = getTransitionOverlay();
  window.clearTimeout(navigationTimer);
  overlay.hidden = false;
  void overlay.offsetWidth;
  overlay.classList.add("is-visible");
  navigationTimer = window.setTimeout(() => {
    if (replace) {
      window.location.replace(target.href);
    } else {
      window.location.assign(target.href);
    }
  }, 180);
}

window.addEventListener("pagehide", hideNavigationTransition);
window.addEventListener("pageshow", hideNavigationTransition);

document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  const clickedElement = event.target instanceof Element ? event.target : null;
  const link = clickedElement?.closest("a[href]");
  if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;

  const target = new URL(link.href, window.location.href);
  if (!["http:", "https:", "file:"].includes(target.protocol)) return;
  if (
    target.origin === window.location.origin &&
    target.pathname === window.location.pathname &&
    target.search === window.location.search
  ) {
    return;
  }

  event.preventDefault();
  navigateWithTransition(target.href);
});
