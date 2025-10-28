// db.js
import { createClient } from "@libsql/client/node"; // Node.js client for server-side use

// Initialize the client
export const client = createClient({
  url: process.env.TURSO_DATABASE_URL,   // from your Vercel secrets
  authToken: process.env.TURSO_AUTH_TOKEN, // from your Vercel secrets
});

// Test the connection immediately (optional)
(async () => {
  try {
    await client.execute("SELECT 1;");
    console.log("✅ Turso DB connected successfully.");
  } catch (err) {
    console.error("❌ Turso DB connection failed:", err.message);
  }
})();
