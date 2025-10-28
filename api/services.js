import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    const result = await client.execute("SELECT * FROM services WHERE clinic_id = 1;");
    res.status(200).json({
      message: "Services fetched successfully",
      data: result.rows
    });
  } catch (err) {
    console.error("❌ API Error (services):", err.message);
    res.status(500).json({ error: err.message });
  }
}
