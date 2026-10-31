import { loadCart, products, saveCart } from "./menu-catalog.js";
import { showFeedback } from "./feedback.js";

const productGrid = document.querySelector("#full-product-grid");
const cart = loadCart();

function updateCartCount() {
  const itemCount = [...cart.values()].reduce((total, quantity) => total + quantity, 0);
  document.querySelectorAll("[data-cart-count]").forEach((counter) => {
    counter.textContent = String(itemCount);
  });
  document.querySelector(".order-header-cart").setAttribute(
    "aria-label",
    `Go to cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`,
  );
}

function renderMenu() {
  productGrid.replaceChildren();
  for (const product of products) {
    const card = document.createElement("article");
    card.className = "product-card";

    const image = document.createElement("img");
    image.className = "product-image";
    image.src = product.image;
    image.alt = product.name;
    image.loading = "lazy";

    const body = document.createElement("div");
    body.className = "product-body";
    const title = document.createElement("h2");
    title.className = "product-title";
    title.textContent = product.name;
    const description = document.createElement("p");
    description.className = "product-desc";
    description.textContent = product.description;

    const footer = document.createElement("div");
    footer.className = "product-footer";
    const price = document.createElement("span");
    price.className = "product-price";
    price.textContent = `$${product.price.toFixed(2)}`;
    const action = document.createElement("button");
    action.className = "add-button";
    action.type = "button";
    action.dataset.addProduct = String(product.id);
    action.textContent = "Add to cart";
    const quantity = document.createElement("span");
    quantity.className = "menu-cart-quantity";
    quantity.dataset.productQuantity = String(product.id);

    footer.append(price, action, quantity);
    body.append(title, description, footer);
    card.append(image, body);
    productGrid.append(card);
  }
  updateCartCount();
  updateProductQuantities();
}

function updateProductQuantities() {
  for (const product of products) {
    const quantity = cart.get(product.id) || 0;
    const indicator = productGrid.querySelector(`[data-product-quantity="${product.id}"]`);
    indicator.textContent = quantity ? `In cart: ${quantity}` : "";
  }
}

productGrid.addEventListener("click", (event) => {
  const button = event.target instanceof Element
    ? event.target.closest("[data-add-product]")
    : null;
  if (!button) return;

  const productId = Number(button.dataset.addProduct);
  const quantity = cart.get(productId) || 0;
  if (quantity >= 25) {
    showFeedback("You can add up to 25 of each menu item.", true);
    return;
  }

  cart.set(productId, quantity + 1);
  saveCart(cart);
  updateCartCount();
  updateProductQuantities();
  showFeedback(`${products.find((product) => product.id === productId).name} added to your cart.`);
});

renderMenu();
