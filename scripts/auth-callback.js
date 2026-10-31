import { getSupabaseClient } from "./supabase-client.js";
import { navigateWithTransition, showFeedback } from "./feedback.js";

const statusMessage = document.querySelector("[data-callback-status]");
const errorMessage = new URLSearchParams(window.location.search).get("error_description");

if (errorMessage) {
  document.querySelector(".auth-callback-state").classList.add("has-error");
  statusMessage.textContent = "";
  statusMessage.classList.add("auth-status-error");
  showFeedback(errorMessage, true);
} else {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;
    if (!data.session) {
      throw new Error("Authentication could not be completed. Please try again.");
    }

    statusMessage.textContent = "";
    const destination = new URLSearchParams(window.location.search).get("next");
    const allowedDestinations = new Set([
      "/account", "/admin", "/", "/checkout",
      "account.html", "admin.html", "index.html", "checkout.html",
    ]);
    navigateWithTransition(
      allowedDestinations.has(destination) ? destination : "/account",
      true,
    );
  } catch (error) {
    document.querySelector(".auth-callback-state").classList.add("has-error");
    statusMessage.textContent = "";
    statusMessage.classList.add("auth-status-error");
    showFeedback(error.message, true);
  }
}
