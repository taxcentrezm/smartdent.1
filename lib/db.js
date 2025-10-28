// db.js
import { createClient } from "@libsql/client";

// Initialize Turso client using env variables
export const client = createClient({
  url: process.env.chomadentistry_TURSO_DATABASE_URL,
  authToken: process.env.chomadentistry_TURSO_AUTH_TOKEN,
  fetch // required in Vercel serverless environment
});

// Optional: test connection immediately (for logs)
(async () => {
  try {
    await client.execute("SELECT 1;"); // simple test query
    console.log("✅ Turso DB connected successfully");
  } catch (err) {
    console.error("❌ Turso DB connection failed:", err.message);
  }
})();
