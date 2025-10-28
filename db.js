import { createClient } from "@libsql/client/node";

const url = process.env.chomadentistry_TURSO_DATABASE_URL;
const authToken = process.env.chomadentistry_TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error(
    "❌ Turso DB connection failed: Environment variables are missing!"
  );
}

export const client = createClient({
  url,
  authToken,
  fetchMigrations: false, // <-- disable migration checks
});

(async () => {
  try {
    await client.execute("SELECT 1;");
    console.log("✅ Turso DB connected successfully (no migration check)");
  } catch (err) {
    console.error("❌ Turso DB connection failed:", err.message);
  }
})();
