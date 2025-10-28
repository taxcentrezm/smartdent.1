import { createClient } from "@libsql/client/node";

const url = process.env.chomadentistry_TURSO_DATABASE_URL;
const authToken = process.env.chomadentistry_TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error(
    "❌ Turso DB connection failed: Environment variables are missing!"
  );
}

console.log("Connecting to Turso DB at:", url);

export const client = createClient({
  url,
  authToken,
});

(async () => {
  try {
    await client.execute("SELECT 1;");
    console.log("✅ Turso DB connected successfully");
  } catch (err) {
    console.error("❌ Turso DB connection failed:", err.message);
  }
})();
