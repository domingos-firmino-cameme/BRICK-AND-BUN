import { getSupabaseClient } from "./supabase-client.js";
import { navigateWithTransition, showFeedback } from "./feedback.js";

const statusMessage = document.querySelector("#admin-status");
const orderList = document.querySelector("#admin-order-list");
const refreshButton = document.querySelector("#admin-refresh");
const orderView = document.querySelector("#view-orders");
const homeView = document.querySelector("#view-home");
const notificationsView = document.querySelector("#view-notifications");
const homeRoot = document.querySelector("#admin-home-root");
const shell = document.querySelector("#app-shell");
const sidebarToggle = document.querySelector("#sidebar-toggle");
const sidebarNav = document.querySelector("#sidebar-nav");
const sidebarNavWrap = document.querySelector("#sidebar-nav-wrap");
const sidebarNavHint = document.querySelector("#sidebar-nav-hint");
const notificationForm = document.querySelector("#admin-notification-form");
const notificationAudience = document.querySelector("#notification-audience");
const notificationRecipient = document.querySelector("#notification-recipient");
const notificationSubmit = document.querySelector("#notification-submit");
const authPendingMessage = document.querySelector("#admin-auth-pending");

const orderStatuses = [
  ["received", "Received"],
  ["confirmed", "Confirmed"],
  ["preparing", "Preparing"],
  ["out_for_delivery", "Out for delivery"],
  ["delivered", "Delivered"],
  ["cancelled", "Canceled"],
];

const viewMeta = {
  home: { eyebrow: "Central Austin delivery", title: "Overview" },
  orders: { eyebrow: "Kitchen & delivery", title: "Orders" },
  notifications: { eyebrow: "Customer updates", title: "Notifications" },
};

let supabase;
let ordersCache = [];
let notificationRecipientsLoaded = false;
let notificationRecipientsLoading = false;

function showStatus(message, isError = false) {
  statusMessage.textContent = "";
  showFeedback(message, isError);
}

function appendText(parent, tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function createEmptyState(iconClass, title, description) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  const icon = document.createElement("div");
  icon.className = "empty-state-icon";
  icon.setAttribute("aria-hidden", "true");
  const glyph = document.createElement("i");
  glyph.className = iconClass;
  icon.append(glyph);
  empty.append(icon);
  appendText(empty, "h2", "", title);
  appendText(empty, "p", "", description);
  return empty;
}

function showUnavailableState(title, description) {
  const homeEmpty = createEmptyState("fa-solid fa-circle-exclamation", title, description);
  homeEmpty.querySelector("h2").id = "admin-home-heading";
  homeRoot.replaceChildren(homeEmpty);
  orderList.replaceChildren(
    createEmptyState("fa-solid fa-circle-exclamation", title, description),
  );
}

function formatAddress(address = {}) {
  return [
    address.street,
    address.unit,
    `${address.city || ""}${address.state ? `, ${address.state}` : ""} ${address.postal_code || ""}`.trim(),
  ].filter(Boolean).join(", ");
}

function statusLabel(status) {
  return orderStatuses.find(([value]) => value === status)?.[1] || status;
}

function statusBadgeClass(status) {
  if (status === "delivered") return "delivered";
  if (status === "out_for_delivery") return "out";
  if (status === "cancelled") return "cancelled";
  return "";
}

function showView(name, updateLocation = true) {
  if (!viewMeta[name]) name = "orders";

  const views = {
    home: homeView,
    orders: orderView,
    notifications: notificationsView,
  };
  for (const [viewName, view] of Object.entries(views)) {
    const isActive = viewName === name;
    view.classList.toggle("is-active", isActive);
    view.hidden = !isActive;
    view.setAttribute("aria-hidden", String(!isActive));
  }

  sidebarNav.querySelectorAll(".nav-item").forEach((button) => {
    if (button.dataset.view === name) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  const meta = viewMeta[name];
  document.querySelector("#topbar-eyebrow").textContent = meta.eyebrow;
  document.querySelector("#topbar-heading").textContent = meta.title;
  refreshButton.hidden = name !== "orders";
  if (updateLocation) history.replaceState(null, "", `#${name}`);
}

function renderOverview() {
  homeRoot.replaceChildren();

  if (ordersCache.length === 0) {
    const empty = createEmptyState(
      "fa-solid fa-receipt",
      "No orders yet",
      "New customer delivery orders will appear here and under Orders.",
    );
    empty.querySelector("h2").id = "admin-home-heading";
    const actions = document.createElement("div");
    actions.className = "empty-state-actions";
    const openOrders = appendText(actions, "button", "btn-primary", "Open orders");
    openOrders.type = "button";
    openOrders.dataset.view = "orders";
    empty.append(actions);
    homeRoot.append(empty);
    return;
  }

  const counts = Object.fromEntries(orderStatuses.map(([value]) => [value, 0]));
  for (const order of ordersCache) {
    if (Object.hasOwn(counts, order.status)) counts[order.status] += 1;
  }
  const active = counts.received + counts.confirmed + counts.preparing + counts.out_for_delivery;

  const content = document.createElement("div");
  content.className = "home-active";
  const intro = document.createElement("div");
  intro.className = "home-intro";
  appendText(intro, "h2", "", "Kitchen overview").id = "admin-home-heading";
  appendText(intro, "p", "home-intro-copy", "Live snapshot of central Austin delivery orders.");
  content.append(intro);

  const stats = document.createElement("div");
  stats.className = "home-stats home-stats-3";
  const statData = [
    ["Active", active, "In progress right now"],
    ["Out for delivery", counts.out_for_delivery, "On the road"],
    ["Total loaded", ordersCache.length, "Last 100 orders"],
  ];
  for (const [label, count, detail] of statData) {
    const card = document.createElement("article");
    card.className = "card home-stat";
    appendText(card, "p", "section-eyebrow", label);
    appendText(card, "strong", "", count);
    appendText(card, "p", "", detail);
    stats.append(card);
  }
  content.append(stats);

  const pipeline = document.createElement("section");
  pipeline.className = "card";
  const header = document.createElement("div");
  header.className = "card-head";
  const heading = document.createElement("div");
  appendText(heading, "p", "section-eyebrow", "By status");
  appendText(heading, "h2", "", "Pipeline");
  const viewAll = appendText(header, "button", "btn-text", "View all");
  viewAll.type = "button";
  viewAll.dataset.view = "orders";
  header.append(heading);
  pipeline.append(header);

  const rows = document.createElement("div");
  rows.className = "admin-pipeline";
  for (const [status, label] of orderStatuses) {
    const row = document.createElement("div");
    row.className = "admin-pipeline-row";
    appendText(row, "span", "", label);
    appendText(row, "strong", "", counts[status]);
    rows.append(row);
  }
  pipeline.append(rows);
  header.append(viewAll);
  content.append(pipeline);
  homeRoot.append(content);
}

function renderOrders(orders) {
  ordersCache = orders || [];
  orderList.replaceChildren();

  if (ordersCache.length === 0) {
    const empty = createEmptyState(
      "fa-solid fa-receipt",
      "No delivery orders yet",
      "When customers place orders, they show up here for status updates.",
    );
    orderList.append(empty);
    renderOverview();
    return;
  }

  for (const order of ordersCache) {
    const card = document.createElement("article");
    card.className = "admin-order-card";

    const heading = document.createElement("div");
    heading.className = "admin-order-heading";
    const headingCopy = document.createElement("div");
    appendText(headingCopy, "h2", "", `Order ${order.id.slice(0, 8).toUpperCase()}`);
    appendText(headingCopy, "p", "order-meta", new Date(order.created_at).toLocaleString());
    appendText(headingCopy, "span", `badge ${statusBadgeClass(order.status)}`, statusLabel(order.status));

    const statusSelect = document.createElement("select");
    statusSelect.className = "admin-status-select";
    statusSelect.setAttribute("aria-label", `Update status for order ${order.id.slice(0, 8)}`);
    for (const [value, label] of orderStatuses) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = value === order.status;
      option.disabled = value === "received" && order.status !== "received";
      statusSelect.append(option);
    }
    statusSelect.addEventListener("change", () => updateOrderStatus(order.id, statusSelect, order.status));
    heading.append(headingCopy, statusSelect);
    card.append(heading);

    const grid = document.createElement("div");
    grid.className = "admin-order-grid";
    const customer = document.createElement("div");
    customer.className = "admin-order-details";
    appendText(customer, "h3", "", "Customer");
    appendText(customer, "p", "", order.customer_name || "—");
    appendText(customer, "p", "", order.customer_email || "No email on file");
    appendText(customer, "p", "", order.customer_phone || "No phone on file");
    grid.append(customer);

    const address = order.address_snapshot || {};
    const delivery = document.createElement("div");
    delivery.className = "admin-order-details";
    appendText(delivery, "h3", "", `Deliver to: ${address.recipient_name || "—"}`);
    appendText(delivery, "p", "", `${address.label || ""}${address.label ? " · " : ""}${formatAddress(address)}`);
    if (address.delivery_instructions) {
      appendText(delivery, "p", "", `Instructions: ${address.delivery_instructions}`);
    }
    grid.append(delivery);

    const items = document.createElement("ul");
    items.className = "order-items order-item-list";
    for (const item of order.order_items || []) {
      appendText(items, "li", "", `${item.quantity} × ${item.item_name} — $${Number(item.line_total).toFixed(2)}`);
    }
    grid.append(items);
    card.append(grid);

    if (order.customer_note) {
      appendText(card, "p", "admin-customer-note", `Customer note: ${order.customer_note}`);
    }
    appendText(card, "p", "order-subtotal", `Subtotal: $${Number(order.subtotal).toFixed(2)}`);
    orderList.append(card);
  }

  renderOverview();
}

async function updateOrderStatus(orderId, select, previousStatus) {
  // Check if the user is offline before proceeding with network actions
  if (!navigator.onLine) {
    window.location.href = "/offline.html";
    return;
  }

  select.disabled = true;
  showStatus("");
  try {
    const { error } = await supabase.rpc("update_order_status", {
      p_order_id: orderId,
      p_status: select.value,
    });
    if (error) throw error;

    const order = ordersCache.find((item) => item.id === orderId);
    if (order) order.status = select.value;
    renderOrders(ordersCache);
    showStatus(`Order ${orderId.slice(0, 8).toUpperCase()} updated.`);
  } catch (error) {
    // If the network request fails due to lack of connection, redirect to offline page
    if (!navigator.onLine || error.message.includes("Failed to fetch")) {
      window.location.href = "/offline.html";
      return;
    }
    select.value = previousStatus;
    showStatus(error.message || "Could not update the order status.", true);
  } finally {
    select.disabled = false;
  }
}

async function loadOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("id, user_id, address_snapshot, customer_name, customer_email, customer_phone, status, customer_note, subtotal, created_at, order_items(item_name, quantity, line_total)")
    .neq("status", "pending_payment")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  renderOrders(data || []);
}

function setSidebarCollapsed(collapsed) {
  shell.classList.toggle("is-collapsed", collapsed);
  sidebarToggle.querySelector("svg").classList.toggle("is-collapsed", collapsed);
  sidebarToggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
  sidebarToggle.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
}

async function loadNotificationRecipients() {
  if (notificationRecipientsLoaded || notificationRecipientsLoading) return;
  notificationRecipientsLoading = true;
  notificationRecipient.replaceChildren();
  const prompt = document.createElement("option");
  prompt.value = "";
  prompt.textContent = "Loading users...";
  notificationRecipient.append(prompt);
  updateNotificationAudience();

  try {
    const { data, error } = await supabase.rpc("get_admin_notification_recipients");
    if (error) throw error;

    prompt.textContent = "Choose a user";
    for (const recipient of data || []) {
      const option = document.createElement("option");
      option.value = recipient.user_id;
      option.textContent = `${recipient.full_name || "Customer"} — ${recipient.email || recipient.user_id}`;
      notificationRecipient.append(option);
    }
    notificationRecipientsLoaded = true;
  } catch (error) {
    showFeedback(error.message || "Could not load notification recipients.", true);
    notificationAudience.value = "all";
  } finally {
    notificationRecipientsLoading = false;
    updateNotificationAudience();
  }
}

function updateNotificationAudience() {
  const isIndividual = notificationAudience.value === "user";
  notificationRecipient.disabled = !isIndividual || !notificationRecipientsLoaded;
  notificationRecipient.required = isIndividual;
  notificationSubmit.disabled =
    notificationRecipientsLoading || (isIndividual && !notificationRecipientsLoaded);
  if (isIndividual && !notificationRecipientsLoaded) {
    void loadNotificationRecipients();
  }
}

notificationAudience.addEventListener("change", updateNotificationAudience);

notificationForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  // Check if the user is offline before proceeding with network actions
  if (!navigator.onLine) {
    window.location.href = "/offline.html";
    return;
  }

  notificationSubmit.disabled = true;
  try {
    const formData = new FormData(notificationForm);
    const recipientId = notificationAudience.value === "user"
      ? String(formData.get("recipient"))
      : null;
    if (notificationAudience.value === "user" && !recipientId) {
      throw new Error("Choose a user to receive this notification.");
    }

    const { data: sentCount, error } = await supabase.rpc("send_in_app_notification", {
      p_recipient_id: recipientId,
      p_title: String(formData.get("title")).trim(),
      p_message: String(formData.get("message")).trim(),
    });
    if (error) throw error;

    notificationForm.reset();
    notificationAudience.value = "all";
    updateNotificationAudience();
    showFeedback(`Notification sent to ${sentCount} ${sentCount === 1 ? "user" : "users"}.`);
  } catch (error) {
    // If the network request fails due to lack of connection, redirect to offline page
    if (!navigator.onLine || error.message.includes("Failed to fetch")) {
      window.location.href = "/offline.html";
      return;
    }
    showFeedback(error.message || "Could not send the notification.", true);
  } finally {
    updateNotificationAudience();
  }
});

function updateNavScrollHints() {
  const maxScroll = sidebarNav.scrollWidth - sidebarNav.clientWidth;
  const hasOverflow = maxScroll > 4;
  const atStart = sidebarNav.scrollLeft <= 2;
  const atEnd = sidebarNav.scrollLeft >= maxScroll - 2;
  sidebarNavWrap.classList.toggle("can-scroll-left", hasOverflow && !atStart);
  sidebarNavWrap.classList.toggle("can-scroll-right", hasOverflow && !atEnd);
  sidebarNavHint.hidden = !(hasOverflow && !atEnd);
}

sidebarToggle.addEventListener("click", () => {
  setSidebarCollapsed(!shell.classList.contains("is-collapsed"));
});

sidebarNav.addEventListener("click", (event) => {
  const target = event.target instanceof Element
    ? event.target.closest("button[data-view]")
    : null;
  if (!target || !sidebarNav.contains(target)) return;
  event.preventDefault();
  event.stopPropagation();
  showView(target.dataset.view);
});
sidebarNav.addEventListener("scroll", updateNavScrollHints, { passive: true });
sidebarNavHint.addEventListener("click", () => {
  sidebarNav.scrollBy({ left: sidebarNav.clientWidth * 1.25, behavior: "smooth" });
});
window.addEventListener("resize", updateNavScrollHints);

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest("[data-view]") : null;
  if (!target?.dataset.view || sidebarNav.contains(target)) return;
  event.preventDefault();
  showView(target.dataset.view);
});

refreshButton.addEventListener("click", async () => {
  // Check if the user is offline before proceeding with network actions
  if (!navigator.onLine) {
    window.location.href = "/offline.html";
    return;
  }

  refreshButton.disabled = true;
  showStatus("");
  try {
    await loadOrders();
    showStatus("Orders refreshed.");
  } catch (error) {
    // If the network request fails due to lack of connection, redirect to offline page
    if (!navigator.onLine || error.message.includes("Failed to fetch")) {
      window.location.href = "/offline.html";
      return;
    }
    showStatus(error.message || "Could not refresh delivery orders.", true);
  } finally {
    refreshButton.disabled = false;
  }
});

document.querySelector("#admin-signout").addEventListener("click", async () => {
  if (!supabase) {
    showStatus("Authentication is unavailable. Check the Supabase configuration.", true);
    return;
  }

  // Check if the user is offline before proceeding with network actions
  if (!navigator.onLine) {
    window.location.href = "/offline.html";
    return;
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    showStatus(error.message || "Could not sign out.", true);
    return;
  }
  navigateWithTransition("/");
});

showView(location.hash.slice(1) || "orders", false);
updateNavScrollHints();

try {
  supabase = getSupabaseClient();
  showStatus("Loading orders...");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    navigateWithTransition("/login?next=/admin", true);
  } else if (data.session.user.app_metadata?.role !== "admin") {
    authPendingMessage.querySelector("strong").textContent = "Administrator access required.";
    authPendingMessage.querySelector("span").textContent =
      "Sign in with an authorized administrator account to view this dashboard.";
  } else {
    document.documentElement.classList.remove("auth-pending");
    shell.hidden = false;
    await loadOrders();
    showStatus("Orders are loaded.");
    notificationSubmit.disabled = false;
    updateNotificationAudience();
  }
} catch (error) {
  authPendingMessage.querySelector("strong").textContent = "Could not verify administrator access.";
  authPendingMessage.querySelector("span").textContent =
    error.message || "Connect to the service and reload this page.";
}