import { client } from "../db.js";

export default async function handler(req, res) {
  console.log("📥 Incoming request to /api/services");
  console.log("🔍 Request method:", req.method);
  console.log("🔍 Request URL:", req.url);
  console.log("🔍 Request headers:", req.headers);

  try {
    const result = await client.execute("SELECT * FROM services WHERE clinic_id = 1;");
    console.log("✅ Query executed successfully:", result.rows.length, "rows returned");

    res.status(200).json({
      message: "Services fetched successfully",
      data: result.rows
    });
  } catch (err) {
    console.error("❌ API Error (services):", err.message);
    res.status(500).json({ error: err.message });
  }
}
