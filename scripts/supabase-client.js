const SUPABASE_URL = "https://pqjdseubbijwmtcdmcpb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxamRzZXViYmlqd210Y2RtY3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDAzNjYsImV4cCI6MjEwNzg3NjM2Nn0.RjPoDBtXGq3FSvsgZduHQ9eEYMPgV1dTUhlKsR5-hTA";
const isLocalDemo =
  (["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname) ||
    window.location.protocol === "file:") &&
  new URLSearchParams(window.location.search).get("demo") === "1" &&
  ["admin", "account", "admin.html", "account.html"].includes(window.location.pathname.split("/").pop());
const { createClient } = isLocalDemo
  ? { createClient: null }
  : await import("https://esm.sh/@supabase/supabase-js@2");
const { createDemoClient } = isLocalDemo
  ? await import("./supabase-demo-client.js")
  : { createDemoClient: null };

// Use the public anon key here; never expose a service_role key in browser code.
// Enable OAuth providers and SMS in Supabase, then allow auth-callback.html as a redirect URL.
let client = isLocalDemo ? createDemoClient() : null;

export function isSupabaseConfigured() {
  if (isLocalDemo) return true;
  return (
    !SUPABASE_URL.includes("YOUR_PROJECT_ID") &&
    !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY")
  );
}

export function getSupabaseClient() {
  if (isLocalDemo) return client;
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Configure SUPABASE_URL and SUPABASE_ANON_KEY in scripts/supabase-client.js before using authentication.",
    );
  }

  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

export function getAuthCallbackUrl() {
  // Use the same clean URL accepted by Vercel. Do not switch this back to
  // auth-callback.html because confirmation links and cached navigation must
  // resolve through the same callback route.
  const callbackUrl = new URL("/auth-callback", window.location.origin);
  const destination = new URLSearchParams(window.location.search).get("next");
  if (["/account", "/admin", "/", "/checkout"].includes(destination)) {
    callbackUrl.searchParams.set("next", destination);
  }
  return callbackUrl.href;
}
