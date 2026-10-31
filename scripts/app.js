import { getSupabaseClient } from "./supabase-client.js";
import { navigateWithTransition, showFeedback } from "./feedback.js";
import { startStripeCheckout } from "./stripe-checkout.js";
import { loadCart, products, saveCart } from "./menu-catalog.js";

const productGrid = document.querySelector("#product-grid");
const menuToggle = document.querySelector("#menu-toggle");
const mobileNav = document.querySelector("#mobile-nav");
const desktopCartButton = document.querySelector("#cart-open");
const cartDrawer = document.querySelector("#cart-drawer");
const cartBackdrop = document.querySelector("#cart-backdrop");
const cartCloseButton = document.querySelector("#cart-close");
const cartItems = document.querySelector("#cart-items");
const cartItemCount = document.querySelector("#cart-item-count");
const cartTotal = document.querySelector("#cart-total");
const cartCheckoutButton = document.querySelector("#cart-checkout");
const cartClearButton = document.querySelector("#cart-clear");
const demoNotice = document.querySelector("#demo-notice");
const newsletterForm = document.querySelector("#newsletter-form");
const newsletterStatus = document.querySelector("#newsletter-status");
const deliveryAddress = document.querySelector("#cart-address");
const customerNote = document.querySelector("#cart-customer-note");
const orderStatus = document.querySelector("#cart-order-status");

const requiredElements = [
  productGrid,
  menuToggle,
  mobileNav,
  desktopCartButton,
  cartDrawer,
  cartBackdrop,
  cartCloseButton,
  cartItems,
  cartItemCount,
  cartTotal,
  cartCheckoutButton,
  cartClearButton,
  demoNotice,
  newsletterForm,
  newsletterStatus,
  deliveryAddress,
  customerNote,
  orderStatus,
];

if (requiredElements.some((element) => !element)) {
  throw new Error("Brick & Bun page is missing a required element.");
}

const cart = loadCart();
let returnFocusTarget = null;

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function renderMenu() {
  productGrid.innerHTML = products
    .filter((product) => product.featured)
    .map(
      (product) => `
        <article class="product-card" data-product-id="${product.id}">
          <img
            src="${escapeHTML(product.image)}"
            alt="${escapeHTML(product.name)}"
            class="product-image"
            loading="lazy"
          />
          <div class="product-body">
            <h3 class="product-title">${escapeHTML(product.name)}</h3>
            <p class="product-desc">${escapeHTML(product.description)}</p>
            <div class="product-footer">
              <span class="product-price">$${product.price.toFixed(2)}</span>
              <button class="add-button" type="button" data-add-product="${product.id}">
                Add to cart
              </button>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function getCartLines() {
  return products
    .filter((product) => cart.has(product.id))
    .map((product) => ({
      ...product,
      quantity: cart.get(product.id),
    }));
}

function renderCart() {
  const lines = getCartLines();
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce(
    (sum, line) => sum + line.price * line.quantity,
    0,
  );

  document.querySelectorAll("[data-cart-count]").forEach((counter) => {
    counter.textContent = String(itemCount);
  });

  desktopCartButton.setAttribute(
    "aria-label",
    `Open cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`,
  );
  cartItemCount.textContent = String(itemCount);
  cartTotal.textContent = `$${total.toFixed(2)}`;
  cartCheckoutButton.disabled = lines.length === 0;
  cartClearButton.hidden = lines.length === 0;
  saveCart(cart);

  if (lines.length === 0) {
    cartItems.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
    return;
  }

  cartItems.innerHTML = lines
    .map(
      (line) => `
        <div class="cart-row" data-cart-product="${line.id}">
          <div>
            <h3>${escapeHTML(line.name)}</h3>
            <p>$${line.price.toFixed(2)} each</p>
            <div class="quantity-control" aria-label="Quantity">
              <button type="button" data-decrease="${line.id}" aria-label="Remove one ${escapeHTML(line.name)}">−</button>
              <span>${line.quantity}</span>
              <button type="button" data-increase="${line.id}" aria-label="Add one ${escapeHTML(line.name)}">+</button>
            </div>
          </div>
          <span class="cart-row-price">$${(line.price * line.quantity).toFixed(2)}</span>
        </div>
      `,
    )
    .join("");
}

function closeMobileMenu() {
  mobileNav.classList.remove("active");
  mobileNav.setAttribute("aria-hidden", "true");
  menuToggle.classList.remove("active");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
}

function openCart(focusTarget) {
  returnFocusTarget = focusTarget;
  closeMobileMenu();
  cartDrawer.classList.add("open");
  cartDrawer.setAttribute("aria-hidden", "false");
  cartDrawer.inert = false;
  cartBackdrop.classList.add("open");
  cartBackdrop.setAttribute("aria-hidden", "false");
  document.body.classList.add("cart-open");
  orderStatus.textContent = "";
  refreshDeliveryAddresses();
  cartCloseButton.focus();
}

async function refreshDeliveryAddresses() {
  deliveryAddress.replaceChildren();
  const prompt = document.createElement("option");
  prompt.value = "";

  try {
    const supabase = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      prompt.textContent = "Sign in to choose an address";
      deliveryAddress.append(prompt);
      return;
    }

    const { data, error } = await supabase
      .from("delivery_addresses")
      .select("id, label, street, unit, city, state, postal_code, is_default")
      .eq("user_id", sessionData.session.user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!data.length) {
      prompt.textContent = "Add an address in your account first";
      deliveryAddress.append(prompt);
      return;
    }

    prompt.textContent = "Choose a delivery address";
    deliveryAddress.append(prompt);
    for (const address of data) {
      const option = document.createElement("option");
      option.value = address.id;
      option.textContent = `${address.label}: ${address.street}${address.unit ? `, ${address.unit}` : ""}, ${address.city}, ${address.state} ${address.postal_code}`;
      option.selected = address.is_default;
      deliveryAddress.append(option);
    }
  } catch (error) {
    prompt.textContent = "Could not load saved addresses";
    deliveryAddress.append(prompt);
    showFeedback(error.message || "Could not load delivery addresses.", true);
  }
}

function closeCart() {
  cartDrawer.classList.remove("open");
  cartDrawer.setAttribute("aria-hidden", "true");
  cartDrawer.inert = true;
  cartBackdrop.classList.remove("open");
  cartBackdrop.setAttribute("aria-hidden", "true");
  document.body.classList.remove("cart-open");

  if (returnFocusTarget instanceof HTMLElement) {
    returnFocusTarget.focus();
  }
  returnFocusTarget = null;
}

function changeQuantity(productId, amount) {
  const quantity = (cart.get(productId) || 0) + amount;
  if (quantity > 25) {
    showFeedback("You can add up to 25 of each menu item.", true);
    return;
  }
  if (quantity <= 0) {
    cart.delete(productId);
  } else {
    cart.set(productId, quantity);
  }
  demoNotice.hidden = true;
  const product = products.find((item) => item.id === productId);
  showFeedback(amount > 0
    ? `${product.name} added to your cart.`
    : `${product.name} quantity updated.`);
  renderCart();
}

productGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add-product]");
  if (!button) return;

  const productId = Number(button.dataset.addProduct);
  const product = products.find((item) => item.id === productId);
  if (!product) return;

  changeQuantity(productId, 1);
});

cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-decrease], [data-increase]");
  if (!button) return;

  if (button.hasAttribute("data-decrease")) {
    changeQuantity(Number(button.dataset.decrease), -1);
  } else {
    changeQuantity(Number(button.dataset.increase), 1);
  }
});

menuToggle.addEventListener("click", () => {
  const isOpen = !mobileNav.classList.contains("active");
  if (isOpen) {
    mobileNav.classList.add("active");
    mobileNav.setAttribute("aria-hidden", "false");
    menuToggle.classList.add("active");
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Close navigation");
  } else {
    closeMobileMenu();
  }
});

mobileNav.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", closeMobileMenu);
});

desktopCartButton.addEventListener("click", () => {
  navigateWithTransition("/checkout");
});
cartCloseButton.addEventListener("click", closeCart);
cartBackdrop.addEventListener("click", closeCart);

cartClearButton.addEventListener("click", () => {
  cart.clear();
  demoNotice.hidden = true;
  renderCart();
  showFeedback("Your cart has been cleared.");
});

cartCheckoutButton.addEventListener("click", () => {
  placeDeliveryOrder();
});

async function placeDeliveryOrder() {
  // Check if the user is offline before proceeding with network actions
  if (!navigator.onLine) {
    window.location.href = "/offline.html";
    return;
  }

  cartCheckoutButton.disabled = true;
  orderStatus.textContent = "";
  try {
    const supabase = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      saveCart(cart);
      navigateWithTransition("/login?next=/checkout");
      return;
    }

    if (!deliveryAddress.value) {
      throw new Error("Choose a saved delivery address. Add one from your account if needed.");
    }

    const items = getCartLines().map(({ id, quantity }) => ({
      product_id: id,
      quantity,
    }));
    await startStripeCheckout(supabase, {
      addressId: deliveryAddress.value,
      items,
      customerNote: customerNote.value.trim(),
    });
  } catch (error) {
    // If the network request fails due to lack of connection, redirect to offline page
    if (!navigator.onLine || error.message.includes("Failed to fetch")) {
      window.location.href = "/offline.html";
      return;
    }
    showFeedback(error.message || "Could not start secure payment.", true);
  } finally {
    cartCheckoutButton.disabled = cart.size === 0;
  }
}

newsletterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  
  // Check if the user is offline before proceeding with network actions
  if (!navigator.onLine) {
    window.location.href = "/offline.html";
    return;
  }

  const submitButton = newsletterForm.querySelector('button[type="submit"]');
  const email = String(new FormData(newsletterForm).get("email")).trim();
  submitButton.disabled = true;
  newsletterStatus.textContent = "";
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc("subscribe_newsletter", { p_email: email });
    if (error) throw error;
    newsletterForm.reset();
    showFeedback("You're on the list. Look out for our next update.");
  } catch (error) {
    // If the network request fails due to lack of connection, redirect to offline page
    if (!navigator.onLine || error.message.includes("Failed to fetch")) {
      window.location.href = "/offline.html";
      return;
    }
    showFeedback(error.message || "Could not subscribe. Please try again.", true);
  } finally {
    submitButton.disabled = false;
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (cartDrawer.classList.contains("open")) closeCart();
    closeMobileMenu();
  }
});

renderMenu();
renderCart();