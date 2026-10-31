import { navigateWithTransition } from "./feedback.js";

export async function startStripeCheckout(supabase, { addressId, items, customerNote }) {
  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: {
      address_id: addressId,
      items,
      customer_note: customerNote,
    },
  });
  if (error) throw error;

  let checkoutUrl;
  try {
    checkoutUrl = new URL(data?.checkout_url);
  } catch {
    throw new Error("Stripe did not return a valid checkout link.");
  }
  if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.stripe.com") {
    throw new Error("Stripe returned an unexpected checkout destination.");
  }

  navigateWithTransition(checkoutUrl.href);
}
