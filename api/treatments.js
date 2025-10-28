// api/treatments.js
import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    switch (req.method) {
      case "GET": {
        const result = await client.execute("SELECT * FROM treatments;");
        res.status(200).json(result.rows);
        break;
      }
      case "POST": {
        const { name, service_id, price } = req.body;

        if (!name || !service_id || !price) {
          return res.status(400).json({ error: "name, service_id, and price are required." });
        }

        await client.execute(
          "INSERT INTO treatments (name, service_id, price) VALUES (?, ?, ?);",
          [name, service_id, price]
        );

        res.status(201).json({ message: "Treatment created" });
        break;
      }
      default:
        res.setHeader("Allow", ["GET", "POST"]);
        res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ API Error (treatments):", err);
    res.status(500).json({ error: err.message });
  }
}
