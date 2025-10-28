import { createClient } from "@libsql/client";

// Turso client
export const client = createClient({
  url: process.env.chomadentistry_TURSO_DATABASE_URL,
  authToken: process.env.chomadentistry_TURSO_AUTH_TOKEN,
});

// Test connection
(async () => {
  try {
    await client.execute("SELECT 1;");
    console.log("✅ Turso DB connected successfully");
  } catch (err) {
    console.error("❌ Turso DB connection failed:", err.message);
  }
})();
