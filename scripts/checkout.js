import { getSupabaseClient } from "./supabase-client.js";
import { navigateWithTransition, showFeedback } from "./feedback.js";
import { startStripeCheckout } from "./stripe-checkout.js";
import {
  CART_STORAGE_KEY,
  loadCart,
  products,
  saveCart,
} from "./menu-catalog.js";

const checkoutLayout = document.querySelector(".checkout-layout");
const itemsContainer = document.querySelector("#checkout-items");
const itemCountElement = document.querySelector("#checkout-item-count");
const totalElement = document.querySelector("#checkout-total");
const addressSelect = document.querySelector("#checkout-address");
const addressHint = document.querySelector("#checkout-address-hint");
const customerNote = document.querySelector("#checkout-note");
const submitButton = document.querySelector("#checkout-submit");
const clearButton = document.querySelector("#checkout-clear");
const emptyState = document.querySelector("#checkout-empty");
const cart = loadCart();
const checkoutStatus = document.querySelector("#checkout-status");
let waitingForPayment = false;

function getCartLines() {
  return products
    .filter((product) => cart.has(product.id))
    .map((product) => ({ ...product, quantity: cart.get(product.id) }));
}

function changeQuantity(productId, amount) {
  const quantity = (cart.get(productId) || 0) + amount;
  if (quantity > 25) {
    showFeedback("You can add up to 25 of each menu item.", true);
    return;
  }
  if (quantity <= 0) cart.delete(productId);
  else cart.set(productId, quantity);

  saveCart(cart);
  renderCart();
}

function renderCart() {
  const lines = getCartLines();
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const isEmpty = lines.length === 0;

  itemsContainer.replaceChildren();
  itemCountElement.textContent = String(count);
  totalElement.textContent = `$${total.toFixed(2)}`;
  checkoutLayout.hidden = isEmpty;
  emptyState.hidden = !isEmpty;
  clearButton.hidden = isEmpty;
  submitButton.disabled = isEmpty;

  for (const line of lines) {
    const row = document.createElement("article");
    row.className = "checkout-line";
    const details = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = line.name;
    const unitPrice = document.createElement("p");
    unitPrice.textContent = `$${line.price.toFixed(2)} each`;
    const quantity = document.createElement("div");
    quantity.className = "quantity-control";

    const decrease = document.createElement("button");
    decrease.type = "button";
    decrease.dataset.decrease = String(line.id);
    decrease.setAttribute("aria-label", `Remove one ${line.name}`);
    decrease.textContent = "−";
    const quantityValue = document.createElement("span");
    quantityValue.textContent = String(line.quantity);
    const increase = document.createElement("button");
    increase.type = "button";
    increase.dataset.increase = String(line.id);
    increase.setAttribute("aria-label", `Add one ${line.name}`);
    increase.textContent = "+";
    quantity.append(decrease, quantityValue, increase);
    details.append(title, unitPrice, quantity);

    const lineTotal = document.createElement("strong");
    lineTotal.className = "checkout-line-total";
    lineTotal.textContent = `$${(line.price * line.quantity).toFixed(2)}`;
    row.append(details, lineTotal);
    itemsContainer.append(row);
  }
}

async function loadDeliveryAddresses() {
  addressSelect.replaceChildren();
  const prompt = document.createElement("option");
  prompt.value = "";
  addressSelect.append(prompt);

  try {
    const supabase = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    if (!sessionData.session) {
      prompt.textContent = "Sign in to choose a delivery address";
      return;
    }

    const { data, error } = await supabase
      .from("delivery_addresses")
      .select("id, label, street, unit, city, state, postal_code, is_default")
      .eq("user_id", sessionData.session.user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;

    addressHint.hidden = data.length > 0;
    if (data.length === 0) {
      prompt.textContent = "Add a delivery address in your account first";
      return;
    }

    prompt.textContent = "Choose a delivery address";
    for (const address of data) {
      const option = document.createElement("option");
      option.value = address.id;
      option.textContent = `${address.label}: ${address.street}${address.unit ? `, ${address.unit}` : ""}, ${address.city}, ${address.state} ${address.postal_code}`;
      option.selected = address.is_default;
      addressSelect.append(option);
    }
  } catch (error) {
    prompt.textContent = "Delivery addresses unavailable";
    showFeedback(error.message || "Could not load delivery addresses.", true);
  }
}

itemsContainer.addEventListener("click", (event) => {
  const button = event.target instanceof Element
    ? event.target.closest("[data-decrease], [data-increase]")
    : null;
  if (!button) return;

  const productId = Number(button.dataset.decrease || button.dataset.increase);
  changeQuantity(productId, button.hasAttribute("data-decrease") ? -1 : 1);
});

clearButton.addEventListener("click", () => {
  cart.clear();
  saveCart(cart);
  renderCart();
  showFeedback("Your cart has been cleared.");
});

submitButton.addEventListener("click", async () => {
  submitButton.disabled = true;
  try {
    const supabase = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      saveCart(cart);
      navigateWithTransition("/login?next=/checkout");
      return;
    }
    if (!addressSelect.value) {
      throw new Error("Choose a saved delivery address. Add one from your account if needed.");
    }

    const items = getCartLines().map(({ id, quantity }) => ({
      product_id: id,
      quantity,
    }));
    await startStripeCheckout(supabase, {
      addressId: addressSelect.value,
      items,
      customerNote: customerNote.value.trim(),
    });
  } catch (error) {
    showFeedback(error.message || "Could not start secure payment.", true);
  } finally {
    submitButton.disabled = cart.size === 0 || waitingForPayment;
  }
});

async function handlePaymentReturn() {
  const parameters = new URLSearchParams(window.location.search);
  const paymentResult = parameters.get("payment");

  if (paymentResult === "cancelled") {
    checkoutStatus.textContent = "Payment was canceled. Your cart is still here if you want to try again.";
    showFeedback("Payment canceled. No charge was made.");
    window.history.replaceState({}, "", window.location.pathname);
    return;
  }
  if (paymentResult !== "success") return;

  const sessionId = parameters.get("session_id");
  if (!sessionId || !/^cs_test_[A-Za-z0-9]+$/.test(sessionId)) {
    checkoutStatus.textContent = "We could not verify this Stripe checkout. Please contact support before retrying.";
    showFeedback("The Stripe checkout reference is invalid.", true);
    return;
  }

  waitingForPayment = true;
  submitButton.disabled = true;
  checkoutStatus.textContent = "Payment submitted. Confirming your order...";

  try {
    const supabase = getSupabaseClient();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, payment_status")
        .eq("stripe_checkout_session_id", sessionId)
        .maybeSingle();
      if (error) throw error;

      if (data?.payment_status === "paid" && data.status !== "pending_payment") {
        cart.clear();
        localStorage.removeItem(CART_STORAGE_KEY);
        customerNote.value = "";
        renderCart();
        checkoutStatus.textContent = `Payment confirmed. Order ${data.id.slice(0, 8).toUpperCase()} is received.`;
        showFeedback(`Payment confirmed. Order ${data.id.slice(0, 8).toUpperCase()} is received.`);
        window.history.replaceState({}, "", window.location.pathname);
        waitingForPayment = false;
        submitButton.disabled = true;
        return;
      }

      if (data?.payment_status === "failed") {
        throw new Error("This checkout expired before payment was completed. Your cart is still available.");
      }

      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    }

    checkoutStatus.textContent = "Payment is still being confirmed. Do not submit another payment; refresh this page shortly.";
    showFeedback("Payment confirmation is still processing. Please do not pay again yet.");
  } catch (error) {
    checkoutStatus.textContent = error.message || "Could not confirm payment status. Do not submit another payment yet.";
    showFeedback(error.message || "Could not confirm payment status.", true);
  }
}

renderCart();
if (cart.size > 0) loadDeliveryAddresses();
handlePaymentReturn();