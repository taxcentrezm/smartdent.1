import { createClient } from "@libsql/client/web";

export const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

(async () => {
  try {
    await client.execute("SELECT 1;");
    console.log("✅ Turso DB connected");
  } catch (err) {
    console.error("❌ Turso DB connection failed:", err.message);
  }
})();
