// api/clinic.js
import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    switch (req.method) {
      case "GET": {
        const result = await client.execute("SELECT * FROM clinic;");
        res.status(200).json(result.rows);
        break;
      }
      case "POST": {
        const { name, address, phone, email } = req.body;

        if (!name || !phone) {
          return res.status(400).json({ error: "name and phone are required." });
        }

        await client.execute(
          "INSERT INTO clinic (name, address, phone, email) VALUES (?, ?, ?, ?);",
          [name, address || null, phone, email || null]
        );

        res.status(201).json({ message: "Clinic created" });
        break;
      }
      default:
        res.setHeader("Allow", ["GET", "POST"]);
        res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ API Error (clinic):", err);
    res.status(500).json({ error: err.message });
  }
}
