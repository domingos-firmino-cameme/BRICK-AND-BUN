import { getAuthCallbackUrl, getSupabaseClient } from "./supabase-client.js";
import { navigateWithTransition, showFeedback } from "./feedback.js";

const authPage = document.querySelector("[data-auth-page]");
const statusMessage = document.querySelector("[data-auth-status]");
const methodButtons = document.querySelectorAll("[data-auth-method]");
const emailForm = document.querySelector("[data-email-form]");
const emailOtpForm = document.querySelector("[data-email-otp-form]");

function showStatus(message, isError = false) {
  statusMessage.textContent = "";
  statusMessage.classList.toggle("auth-status-error", isError);
  showFeedback(message, isError);
}

function setLoading(form, isLoading, label) {
  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Please wait..." : label;
}

function redirectToHome() {
  const destination = new URLSearchParams(window.location.search).get("next");
  const allowedDestinations = new Set([
    "/account", "/admin", "/", "/checkout",
    "account.html", "admin.html", "index.html", "checkout.html",
  ]);
  navigateWithTransition(allowedDestinations.has(destination) ? destination : "/account");
}

methodButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const useEmail = button.dataset.authMethod === "email";

    methodButtons.forEach((methodButton) => {
      const isActive = methodButton === button;
      methodButton.classList.toggle("active", isActive);
      methodButton.setAttribute("aria-pressed", String(isActive));
    });

    emailForm.hidden = !useEmail;
    emailOtpForm.hidden = useEmail;
    showStatus("");
  });
});

emailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitLabel = authPage.dataset.authMode === "signup" ? "Create account" : "Log in";
  const formData = new FormData(form);

  setLoading(form, true, submitLabel);
  showStatus("");

  try {
    const supabase = getSupabaseClient();
    const email = String(formData.get("email")).trim();
    const password = String(formData.get("password"));

    if (authPage.dataset.authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: getAuthCallbackUrl() },
      });

      if (error) throw error;

      if (data.session) {
        redirectToHome();
        return;
      }

      showStatus("Check your email to confirm your account.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      redirectToHome();
    }
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setLoading(form, false, submitLabel);
  }
});

if (emailOtpForm) {
  emailOtpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('[type="submit"]');
  const email = String(new FormData(form).get("email")).trim();
  const codeInput = form.querySelector('[name="code"]');
  const codeLabel = form.querySelector(".otp-input-label");
  const isCodeStep = !codeInput.hidden;
  const submitLabel = isCodeStep ? "Verify code" : "Send email code";

  setLoading(form, true, submitLabel);
  showStatus("");

  try {
    const supabase = getSupabaseClient();

    if (isCodeStep) {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: codeInput.value.trim(),
        type: "email",
      });
      if (error) throw error;
      redirectToHome();
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: authPage.dataset.authMode === "signup" },
    });
    if (error) throw error;

    codeInput.hidden = false;
    codeLabel.hidden = false;
    codeInput.focus();
    submitButton.textContent = "Verify code";
    showStatus("A verification code was sent to your email.");
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    if (!isCodeStep) {
      submitButton.disabled = false;
      if (codeInput.hidden) submitButton.textContent = "Send email code";
    } else {
      submitButton.disabled = false;
      submitButton.textContent = "Verify code";
    }
  }
  });
}

document.querySelectorAll("[data-oauth-provider]").forEach((button) => {
  button.addEventListener("click", async () => {
    button.disabled = true;
    showStatus("");

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: button.dataset.oauthProvider,
        options: {
          redirectTo: getAuthCallbackUrl(),
          ...(button.dataset.oauthProvider === "azure" ? { scopes: "email" } : {}),
        },
      });
      if (error) throw error;
    } catch (error) {
      showStatus(error.message, true);
      button.disabled = false;
    }
  });
});
