import { getSupabaseClient } from "./supabase-client.js";
import { navigateWithTransition, showFeedback } from "./feedback.js";

const statusMessage = document.querySelector("#account-status");
const profileForm = document.querySelector("#profile-form");
const addressForm = document.querySelector("#address-form");
const addressList = document.querySelector("#address-list");
const orderList = document.querySelector("#order-list");
const notificationList = document.querySelector("#account-notification-list");
const notificationCount = document.querySelector("#account-notification-count");
const homeRoot = document.querySelector("#home-root");
const authPendingMessage = document.querySelector("#account-auth-pending");
const shell = document.querySelector("#app-shell");
const sidebarToggle = document.querySelector("#sidebar-toggle");
const sidebarNav = document.querySelector("#sidebar-nav");
const sidebarNavWrap = document.querySelector("#sidebar-nav-wrap");
const sidebarNavHint = document.querySelector("#sidebar-nav-hint");

const viewMeta = {
  home: { eyebrow: "Your Brick & Bun", title: "Home" },
  orders: { eyebrow: "About 2.5 hours", title: "Orders" },
  notifications: { eyebrow: "Updates from Brick & Bun", title: "Notifications" },
  addresses: { eyebrow: "Central Austin delivery", title: "Addresses" },
  profile: { eyebrow: "Personal details", title: "Profile" },
};

const statusLabels = {
  received: "Received",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Canceled",
};

let accountAddresses = [];
let accountOrders = [];
let accountNotifications = [];

function showStatus(message, isError = false) {
  statusMessage.textContent = "";
  showFeedback(message, isError);
}

function showView(name, updateLocation = true) {
  if (!viewMeta[name]) name = "home";

  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("is-active", view.id === `view-${name}`);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    if (button.dataset.view === name) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  const meta = viewMeta[name];
  document.querySelector("#topbar-eyebrow").textContent = meta.eyebrow;
  document.querySelector("#topbar-heading").textContent = meta.title;
  if (updateLocation) history.replaceState(null, "", `#${name}`);
}

function setBusy(form, busy, idleLabel) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = busy;
  button.textContent = busy ? "Saving..." : idleLabel;
}

function appendText(parent, tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function formatAddress(address) {
  return [
    address.street,
    address.unit,
    `${address.city}, ${address.state} ${address.postal_code}`,
  ].filter(Boolean).join(", ");
}

function renderHome(accountDataAvailable = true) {
  homeRoot.replaceChildren();

  if (accountAddresses.length === 0 && accountOrders.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const icon = document.createElement("div");
    icon.className = "empty-state-icon";
    icon.setAttribute("aria-hidden", "true");
    const glyph = document.createElement("i");
    glyph.className = "fa-regular fa-folder-open";
    icon.append(glyph);
    empty.append(icon);
    appendText(empty, "h2", "", accountDataAvailable ? "Nothing here yet" : "Account data unavailable").id = "home-heading";
    appendText(
      empty,
      "p",
      "",
      accountDataAvailable
        ? "Your account is ready. When you place an order or save a delivery address, activity will show up on this home."
        : "Your account activity will appear here once we can connect to your account.",
    );
    const actions = document.createElement("div");
    actions.className = "empty-state-actions";
    if (accountDataAvailable) {
      for (const [view, label, iconClass] of [
        ["addresses", "Add address", "fa-solid fa-plus"],
        ["orders", "View orders", "fa-solid fa-receipt"],
      ]) {
        const button = appendText(actions, "button", view === "addresses" ? "btn-primary" : "btn-secondary", "");
        button.type = "button";
        button.dataset.view = view;
        const buttonIcon = document.createElement("i");
        buttonIcon.className = iconClass;
        buttonIcon.setAttribute("aria-hidden", "true");
        button.append(buttonIcon, document.createTextNode(` ${label}`));
      }
    }
    if (accountDataAvailable) empty.append(actions);
    homeRoot.append(empty);
    return;
  }

  const fullName = profileForm.elements.full_name.value.trim();
  const firstName = fullName.split(/\s+/)[0] || "there";
  const defaultAddress =
    accountAddresses.find((address) => address.is_default) || accountAddresses[0];
  const content = document.createElement("div");
  content.className = "home-active";

  const intro = document.createElement("div");
  intro.className = "home-intro";
  appendText(intro, "h2", "", `Welcome back, ${firstName}`).id = "home-heading";
  appendText(intro, "p", "home-intro-copy", "Here’s what’s on your account right now.");
  content.append(intro);

  const stats = document.createElement("div");
  stats.className = "home-stats";
  for (const [label, count, detail] of [
    ["Addresses", accountAddresses.length, accountAddresses.length ? "Ready for central Austin delivery" : "None saved yet"],
    ["Orders", accountOrders.length, accountOrders.length ? "On this account" : "No orders yet"],
  ]) {
    const stat = document.createElement("article");
    stat.className = "card home-stat";
    appendText(stat, "p", "section-eyebrow", label);
    appendText(stat, "strong", "", count);
    appendText(stat, "p", "", detail);
    stats.append(stat);
  }
  content.append(stats);

  const panels = document.createElement("div");
  panels.className = "home-panels";

  const addressPanel = document.createElement("article");
  addressPanel.className = "card";
  const addressHead = document.createElement("div");
  addressHead.className = "card-head";
  const addressTitle = document.createElement("div");
  appendText(addressTitle, "p", "section-eyebrow", "Delivery");
  appendText(addressTitle, "h2", "", "Default address");
  addressHead.append(addressTitle);
  const manageAddress = appendText(addressHead, "button", "btn-text", "Manage");
  manageAddress.type = "button";
  manageAddress.dataset.view = "addresses";
  addressPanel.append(addressHead);
  if (defaultAddress) {
    const details = document.createElement("div");
    details.className = "account-home-address";
    appendText(details, "h3", "", defaultAddress.label || "Delivery address");
    appendText(details, "p", "", defaultAddress.recipient_name);
    appendText(details, "p", "", formatAddress(defaultAddress));
    if (defaultAddress.delivery_instructions) {
      appendText(details, "p", "", defaultAddress.delivery_instructions);
    }
    addressPanel.append(details);
  } else {
    appendText(addressPanel, "p", "dashboard-empty", "No address saved yet.");
  }

  const ordersPanel = document.createElement("article");
  ordersPanel.className = "card";
  const ordersHead = document.createElement("div");
  ordersHead.className = "card-head";
  const ordersTitle = document.createElement("div");
  appendText(ordersTitle, "p", "section-eyebrow", "Recent");
  appendText(ordersTitle, "h2", "", "Orders");
  ordersHead.append(ordersTitle);
  const allOrders = appendText(ordersHead, "button", "btn-text", "All orders");
  allOrders.type = "button";
  allOrders.dataset.view = "orders";
  ordersPanel.append(ordersHead);

  if (accountOrders.length) {
    const recentList = document.createElement("div");
    recentList.className = "list";
    for (const order of accountOrders.slice(0, 2)) {
      const item = document.createElement("article");
      item.className = "row-card";
      const copy = document.createElement("div");
      const heading = document.createElement("h3");
      appendText(heading, "span", "", `Order ${order.id.slice(0, 8).toUpperCase()}`);
      appendText(
        heading,
        "span",
        `order-status order-status-${order.status}`,
        statusLabels[order.status] || order.status,
      );
      copy.append(heading);
      appendText(copy, "p", "order-date", new Date(order.created_at).toLocaleString());
      appendText(copy, "p", "order-subtotal", `Subtotal: $${Number(order.subtotal).toFixed(2)}`);
      item.append(copy);
      recentList.append(item);
    }
    ordersPanel.append(recentList);
  } else {
    appendText(ordersPanel, "p", "dashboard-empty", "No orders yet.");
  }

  panels.append(addressPanel, ordersPanel);
  content.append(panels);
  homeRoot.append(content);
}

function renderAddresses(addresses, supabase, userId) {
  accountAddresses = addresses;
  addressList.replaceChildren();
  if (addresses.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state account-empty-addresses";
    const icon = document.createElement("div");
    icon.className = "empty-state-icon";
    icon.setAttribute("aria-hidden", "true");
    const glyph = document.createElement("i");
    glyph.className = "fa-solid fa-location-dot";
    icon.append(glyph);
    empty.append(icon);
    appendText(empty, "h2", "", "No addresses saved");
    appendText(empty, "p", "", "Add a central Austin address so deliveries know where to go.");
    const actions = document.createElement("div");
    actions.className = "empty-state-actions";
    const addButton = appendText(actions, "button", "btn-primary", "");
    addButton.type = "button";
    addButton.dataset.accountAction = "add-address";
    const addIcon = document.createElement("i");
    addIcon.className = "fa-solid fa-plus";
    addIcon.setAttribute("aria-hidden", "true");
    addButton.append(addIcon, document.createTextNode(" Add address"));
    empty.append(actions);
    addressList.append(empty);
    renderHome();
    return;
  }

  for (const address of addresses) {
    const card = document.createElement("article");
    card.className = "address-card";
    const details = document.createElement("div");
    details.className = "address-card-details";
    const title = appendText(details, "h3", "", address.label);
    if (address.is_default) {
      appendText(title, "span", "default-address-badge", "Default");
    }
    appendText(details, "p", "", address.recipient_name);
    appendText(details, "p", "", formatAddress(address));
    if (address.delivery_instructions) {
      appendText(details, "p", "address-instructions", address.delivery_instructions);
    }

    const actions = document.createElement("div");
    actions.className = "address-card-actions";
    const editButton = appendText(actions, "button", "dashboard-text-button", "Edit");
    editButton.type = "button";
    editButton.addEventListener("click", () => openAddressForm(address));

    if (!address.is_default) {
      const defaultButton = appendText(actions, "button", "dashboard-text-button", "Make default");
      defaultButton.type = "button";
      defaultButton.addEventListener("click", () => setDefaultAddress(supabase, userId, address.id));
    }

    const deleteButton = appendText(actions, "button", "dashboard-text-button is-danger", "Remove");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => removeAddress(supabase, userId, address.id, address.label));
    card.append(details, actions);
    addressList.append(card);
  }
  renderHome();
}

function renderOrders(orders, supabase, userId) {
  accountOrders = orders;
  orderList.replaceChildren();
  if (orders.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state account-empty-orders";
    const icon = document.createElement("div");
    icon.className = "empty-state-icon";
    icon.setAttribute("aria-hidden", "true");
    const glyph = document.createElement("i");
    glyph.className = "fa-solid fa-receipt";
    icon.append(glyph);
    empty.append(icon);
    appendText(empty, "h2", "", "No orders yet");
    appendText(empty, "p", "", "When you place an order for central Austin delivery, it will appear here.");
    orderList.append(empty);
    renderHome();
    return;
  }

  for (const order of orders) {
    const card = document.createElement("article");
    card.className = "customer-order-card";
    const heading = document.createElement("div");
    heading.className = "customer-order-heading";
    appendText(heading, "h3", "", `Order ${order.id.slice(0, 8).toUpperCase()}`);
    const status = appendText(
      heading,
      "span",
      `order-status order-status-${order.status}`,
      statusLabels[order.status] || order.status,
    );
    status.setAttribute("aria-label", `Order status: ${statusLabels[order.status] || order.status}`);
    card.append(heading);

    const orderDate = new Date(order.created_at);
    appendText(card, "p", "order-date", orderDate.toLocaleString());
    const items = document.createElement("ul");
    items.className = "order-item-list";
    for (const item of order.order_items || []) {
      appendText(items, "li", "", `${item.quantity} × ${item.item_name} — $${Number(item.line_total).toFixed(2)}`);
    }
    card.append(items);
    appendText(card, "p", "order-address", `Delivering to: ${formatAddress(order.address_snapshot)}`);
    if (order.customer_note) appendText(card, "p", "order-date", `Note: ${order.customer_note}`);
    appendText(card, "p", "order-subtotal", `Subtotal: $${Number(order.subtotal).toFixed(2)}`);
    if (order.status === "received") {
      const cancelButton = appendText(card, "button", "dashboard-text-button is-danger", "Cancel order");
      cancelButton.type = "button";
      cancelButton.addEventListener("click", () => cancelOrder(supabase, userId, order.id));
    }
    orderList.append(card);
  }
  renderHome();
}

function renderNotifications() {
  notificationList.replaceChildren();
  const unreadCount = accountNotifications.filter((notification) => !notification.read_at).length;
  notificationCount.textContent = unreadCount ? String(unreadCount) : "";
  notificationCount.hidden = unreadCount === 0;

  if (accountNotifications.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const icon = document.createElement("div");
    icon.className = "empty-state-icon";
    icon.setAttribute("aria-hidden", "true");
    const glyph = document.createElement("i");
    glyph.className = "fa-regular fa-bell";
    icon.append(glyph);
    empty.append(icon);
    appendText(empty, "h2", "", "No notifications");
    appendText(empty, "p", "", "Updates from Brick & Bun will appear here.");
    notificationList.append(empty);
    return;
  }

  for (const notification of accountNotifications) {
    const card = document.createElement("article");
    card.className = `account-notification-card${notification.read_at ? "" : " is-unread"}`;
    const heading = document.createElement("div");
    heading.className = "account-notification-heading";
    appendText(heading, "h3", "", notification.title);
    if (!notification.read_at) appendText(heading, "span", "notification-unread-label", "New");
    card.append(heading);
    appendText(card, "p", "account-notification-message", notification.message);
    appendText(card, "time", "account-notification-date", new Date(notification.created_at).toLocaleString());

    if (!notification.read_at) {
      const markRead = appendText(card, "button", "dashboard-text-button", "Mark as read");
      markRead.type = "button";
      markRead.addEventListener("click", () => markNotificationRead(notification.id));
    }
    notificationList.append(card);
  }
}

async function loadNotifications(supabase) {
  const { data, error } = await supabase
    .from("in_app_notifications")
    .select("id, title, message, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  accountNotifications = data || [];
  renderNotifications();
}

async function markNotificationRead(notificationId) {
  // Check if the user is offline before proceeding with network actions
  if (!navigator.onLine) {
    window.location.href = "/offline.html";
    return;
  }

  showStatus("");
  try {
    const { error } = await supabase.rpc("mark_in_app_notification_read", {
      p_notification_id: notificationId,
    });
    if (error) throw error;
    const notification = accountNotifications.find((item) => item.id === notificationId);
    if (notification) notification.read_at = new Date().toISOString();
    renderNotifications();
    showStatus("Notification marked as read.");
  } catch (error) {
    // If the network request fails due to lack of connection, redirect to offline page
    if (!navigator.onLine || error.message.includes("Failed to fetch")) {
      window.location.href = "/offline.html";
      return;
    }
    showStatus(error.message || "Could not update this notification.", true);
  }
}

async function loadAccount(supabase, user) {
  const [{ data: profile, error: profileError }, { data: addresses, error: addressesError }] =
    await Promise.all([
      supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
      supabase
        .from("delivery_addresses")
        .select("id, label, recipient_name, street, unit, city, state, postal_code, delivery_instructions, is_default")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

  if (profileError) throw profileError;
  if (addressesError) throw addressesError;

  if (!profile) {
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      full_name: user.user_metadata?.full_name || "",
      phone: user.phone || "",
    });
    if (error) throw error;
  }

  profileForm.elements.full_name.value = profile?.full_name || user.user_metadata?.full_name || "";
  profileForm.elements.email.value = user.email || "";
  profileForm.elements.phone.value = profile?.phone || user.phone || "";
  renderAddresses(addresses || [], supabase, user.id);
  renderHome();
  await loadOrders(supabase, user.id);
}

async function loadOrders(supabase, userId) {
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, subtotal, created_at, address_snapshot, customer_note, order_items(item_name, quantity, line_total)")
    .eq("user_id", userId)
    .neq("status", "pending_payment")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  renderOrders(data || [], supabase, userId);
}

function openAddressForm(address = null) {
  addressForm.reset();
  addressForm.elements.id.value = address?.id || "";
  addressForm.elements.label.value = address?.label || "";
  addressForm.elements.recipient_name.value = address?.recipient_name || profileForm.elements.full_name.value;
  addressForm.elements.street.value = address?.street || "";
  addressForm.elements.unit.value = address?.unit || "";
  addressForm.elements.city.value = address?.city || "Austin";
  addressForm.elements.state.value = address?.state || "TX";
  addressForm.elements.postal_code.value = address?.postal_code || "";
  addressForm.elements.delivery_instructions.value = address?.delivery_instructions || "";
  addressForm.elements.is_default.checked = Boolean(address?.is_default);
  addressForm.hidden = false;
  addressForm.elements.label.focus();
}

async function reloadAddresses(supabase, userId) {
  const { data, error } = await supabase
    .from("delivery_addresses")
    .select("id, label, recipient_name, street, unit, city, state, postal_code, delivery_instructions, is_default")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  renderAddresses(data || [], supabase, userId);
}

async function setDefaultAddress(supabase, userId, addressId) {
  // Check if the user is offline before proceeding with network actions
  if (!navigator.onLine) {
    window.location.href = "/offline.html";
    return;
  }

  showStatus("");
  try {
    const { error } = await supabase.rpc("set_default_delivery_address", {
      p_address_id: addressId,
    });
    if (error) throw error;
    await reloadAddresses(supabase, userId);
    showStatus("Default delivery address updated.");
  } catch (error) {
    // If the network request fails due to lack of connection, redirect to offline page
    if (!navigator.onLine || error.message.includes("Failed to fetch")) {
      window.location.href = "/offline.html";
      return;
    }
    showStatus(error.message || "Could not update the default address.", true);
  }
}

async function removeAddress(supabase, userId, addressId, label) {
  if (!window.confirm(`Remove the "${label}" delivery address?`)) return;

  // Check if the user is offline before proceeding with network actions
  if (!navigator.onLine) {
    window.location.href = "/offline.html";
    return;
  }

  showStatus("");
  try {
    const { error } = await supabase
      .from("delivery_addresses")
      .delete()
      .eq("id", addressId)
      .eq("user_id", userId);
    if (error) throw error;
    await reloadAddresses(supabase, userId);
    showStatus("Delivery address removed.");
  } catch (error) {
    // If the network request fails due to lack of connection, redirect to offline page
    if (!navigator.onLine || error.message.includes("Failed to fetch")) {
      window.location.href = "/offline.html";
      return;
    }
    showStatus(error.message || "Could not remove this delivery address.", true);
  }
}

async function cancelOrder(supabase, userId, orderId) {
  if (!window.confirm("Cancel this order? Orders already being prepared can no longer be canceled here.")) {
    return;
  }

  // Check if the user is offline before proceeding with network actions
  if (!navigator.onLine) {
    window.location.href = "/offline.html";
    return;
  }

  showStatus("");
  try {
    const { error } = await supabase.rpc("cancel_customer_order", {
      p_order_id: orderId,
    });
    if (error) throw error;
    await loadOrders(supabase, userId);
    showStatus("Order canceled.");
  } catch (error) {
    // If the network request fails due to lack of connection, redirect to offline page
    if (!navigator.onLine || error.message.includes("Failed to fetch")) {
      window.location.href = "/offline.html";
      return;
    }
    showStatus(error.message || "Could not cancel this order.", true);
  }
}

function setSidebarCollapsed(collapsed) {
  shell.classList.toggle("is-collapsed", collapsed);
  sidebarToggle.querySelector("svg").classList.toggle("is-collapsed", collapsed);
  sidebarToggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
  sidebarToggle.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
}

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
sidebarNav.addEventListener("scroll", updateNavScrollHints, { passive: true });
sidebarNavHint.addEventListener("click", () => {
  sidebarNav.scrollBy({ left: sidebarNav.clientWidth * 1.25, behavior: "smooth" });
});
window.addEventListener("resize", updateNavScrollHints);

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest("[data-view]") : null;
  if (target?.dataset.view) {
    event.preventDefault();
    showView(target.dataset.view);
    return;
  }

  const action = event.target instanceof Element
    ? event.target.closest('[data-account-action="add-address"]')
    : null;
  if (action) openAddressForm();
});

const initialView = location.hash.slice(1);
showView(viewMeta[initialView] ? initialView : "home", false);
updateNavScrollHints();

let supabase;
try {
  supabase = getSupabaseClient();
} catch (error) {
  authPendingMessage.querySelector("strong").textContent = "Account unavailable.";
  authPendingMessage.querySelector("span").textContent =
    error.message || "Could not load the account service. Connect and reload this page.";
}
if (supabase) {
  let sessionData;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    sessionData = data;
  } catch (error) {
    authPendingMessage.querySelector("strong").textContent = "Could not verify your session.";
    authPendingMessage.querySelector("span").textContent =
      error.message || "Connect to the service and reload this page.";
  }
  if (sessionData && !sessionData.session) {
    navigateWithTransition("/login?next=/account", true);
  } else if (sessionData?.session) {
    const user = sessionData.session.user;
    document.documentElement.classList.remove("auth-pending");
    shell.hidden = false;
    try {
      await loadAccount(supabase, user);
      try {
        await loadNotifications(supabase);
      } catch (error) {
        showStatus(
          `Account data loaded, but notifications are unavailable: ${error.message || "Please try again."}`,
          true,
        );
      }
    } catch (error) {
      showStatus(error.message || "Could not load your account.", true);
      renderHome(false);
    }

    profileForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      // Check if the user is offline before proceeding with network actions
      if (!navigator.onLine) {
        window.location.href = "/offline.html";
        return;
      }

      setBusy(profileForm, true, "Save profile");
      showStatus("");
      const formData = new FormData(profileForm);
      const fullName = String(formData.get("full_name")).trim();
      const email = String(formData.get("email")).trim();
      const phone = String(formData.get("phone")).trim();

      try {
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({ id: user.id, full_name: fullName, phone }, { onConflict: "id" });
        if (profileError) throw profileError;
        renderHome();

        if (email !== user.email) {
          const { error: emailError } = await supabase.auth.updateUser({ email });
          if (emailError) {
            showStatus(`Profile saved, but the email could not be updated: ${emailError.message}`, true);
            return;
          }
          showStatus("Profile saved. Confirm the email change using the message sent to your new address.");
        } else {
          showStatus("Profile saved.");
        }
      } catch (error) {
        // If the network request fails due to lack of connection, redirect to offline page
        if (!navigator.onLine || error.message.includes("Failed to fetch")) {
          window.location.href = "/offline.html";
          return;
        }
        showStatus(error.message || "Could not save your profile.", true);
      } finally {
        setBusy(profileForm, false, "Save profile");
      }
    });

    document.querySelector("#address-new").addEventListener("click", () => openAddressForm());
    document.querySelector("#address-cancel").addEventListener("click", () => {
      addressForm.reset();
      addressForm.hidden = true;
    });

    addressForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      // Check if the user is offline before proceeding with network actions
      if (!navigator.onLine) {
        window.location.href = "/offline.html";
        return;
      }

      setBusy(addressForm, true, "Save address");
      showStatus("");
      const formData = new FormData(addressForm);
      const addressId = String(formData.get("id") || "");
      const makeDefault = formData.get("is_default") === "on";
      const address = {
        user_id: user.id,
        label: String(formData.get("label")).trim(),
        recipient_name: String(formData.get("recipient_name")).trim(),
        street: String(formData.get("street")).trim(),
        unit: String(formData.get("unit")).trim(),
        city: String(formData.get("city")).trim(),
        state: String(formData.get("state")).trim().toUpperCase(),
        postal_code: String(formData.get("postal_code")).trim(),
        delivery_instructions: String(formData.get("delivery_instructions")).trim(),
        is_default: false,
      };

      try {
        if (address.city.toLowerCase() !== "austin" || address.state !== "TX") {
          throw new Error("Delivery addresses must be in Austin, Texas.");
        }

        let savedAddressId = addressId;
        if (addressId) {
          const { error } = await supabase
            .from("delivery_addresses")
            .update(address)
            .eq("id", addressId)
            .eq("user_id", user.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("delivery_addresses")
            .insert(address)
            .select("id")
            .single();
          if (error) throw error;
          savedAddressId = data.id;
        }

        if (makeDefault) {
          const { error } = await supabase.rpc("set_default_delivery_address", {
            p_address_id: savedAddressId,
          });
          if (error) throw error;
        }

        addressForm.hidden = true;
        await reloadAddresses(supabase, user.id);
        showStatus("Delivery address saved.");
      } catch (error) {
        // If the network request fails due to lack of connection, redirect to offline page
        if (!navigator.onLine || error.message.includes("Failed to fetch")) {
          window.location.href = "/offline.html";
          return;
        }
        showStatus(error.message || "Could not save this delivery address.", true);
      } finally {
        setBusy(addressForm, false, "Save address");
      }
    });

    document.querySelector("#orders-refresh").addEventListener("click", async (event) => {
      // Check if the user is offline before proceeding with network actions
      if (!navigator.onLine) {
        window.location.href = "/offline.html";
        return;
      }

      const button = event.currentTarget;
      button.disabled = true;
      try {
        await loadOrders(supabase, user.id);
        showStatus("Order history is up to date.");
      } catch (error) {
        // If the network request fails due to lack of connection, redirect to offline page
        if (!navigator.onLine || error.message.includes("Failed to fetch")) {
          window.location.href = "/offline.html";
          return;
        }
        showStatus(error.message || "Could not refresh your orders.", true);
      } finally {
        button.disabled = false;
      }
    });

    document.querySelector("#notifications-refresh").addEventListener("click", async (event) => {
      // Check if the user is offline before proceeding with network actions
      if (!navigator.onLine) {
        window.location.href = "/offline.html";
        return;
      }

      const button = event.currentTarget;
      button.disabled = true;
      try {
        await loadNotifications(supabase);
        showStatus("Notifications are up to date.");
      } catch (error) {
        // If the network request fails due to lack of connection, redirect to offline page
        if (!navigator.onLine || error.message.includes("Failed to fetch")) {
          window.location.href = "/offline.html";
          return;
        }
        showStatus(error.message || "Could not refresh notifications.", true);
      } finally {
        button.disabled = false;
      }
    });

    document.querySelector("#account-delete").addEventListener("click", async (event) => {
      const confirmed = window.confirm(
        "Permanently delete your account, saved addresses, and newsletter subscription? Past order details will be anonymized. This cannot be undone.",
      );
      if (!confirmed) return;

      // Check if the user is offline before proceeding with network actions
      if (!navigator.onLine) {
        window.location.href = "/offline.html";
        return;
      }

      const button = event.currentTarget;
      button.disabled = true;
      showStatus("");
      try {
        const { error } = await supabase.functions.invoke("delete-account");
        if (error) throw error;
        await supabase.auth.signOut({ scope: "local" });
        navigateWithTransition("/");
      } catch (error) {
        // If the network request fails due to lack of connection, redirect to offline page
        if (!navigator.onLine || error.message.includes("Failed to fetch")) {
          window.location.href = "/offline.html";
          return;
        }
        showStatus(error.message || "Could not delete your account.", true);
        button.disabled = false;
      }
    });

    document.querySelector("#account-signout").addEventListener("click", async () => {
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
  }
}