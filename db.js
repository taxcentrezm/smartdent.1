// db.js
import { createClient } from "@libsql/client/web";

export const client = createClient({
  url: process.env.chomadentistry_TURSO_DATABASE_URL,
  authToken: process.env.chomadentistry_TURSO_AUTH_TOKEN,
});

(async () => {
  try {
    console.log("Connecting to Turso DB...");
    await client.execute("SELECT 1;");
    console.log("✅ Turso DB connected successfully");
  } catch (err) {
    console.error("❌ Turso DB connection failed:", err.message);
  }
})();
