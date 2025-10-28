import { createClient } from "@libsql/client";

// Log environment variables (safe to log presence, not values)
console.log("🔧 Initializing Turso client...");
console.log("🔍 DB URL present:", !!process.env.chomadentistry_TURSO_DATABASE_URL);
console.log("🔍 Auth token present:", !!process.env.chomadentistry_TURSO_AUTH_TOKEN);

export const client = createClient({
  url: process.env.chomadentistry_TURSO_DATABASE_URL,
  authToken: process.env.chomadentistry_TURSO_AUTH_TOKEN,
  fetch // required in Vercel serverless environment
});

// Optional: test connection immediately (for logs)
(async () => {
  try {
    await client.execute("SELECT 1;");
    console.log("✅ Turso DB connected successfully");
  } catch (err) {
    console.error("❌ Turso DB connection failed:", err.message);
  }
})();
