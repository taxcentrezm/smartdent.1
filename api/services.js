import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    switch (req.method) {
      case "GET": {
        const result = await client.execute("SELECT * FROM services;");
        res.status(200).json(result.rows);
        break;
      }
      case "POST": {
        const { name, price, description } = req.body;
        if (!name || !price) {
          return res.status(400).json({ error: "name and price are required." });
        }
        await client.execute(
          "INSERT INTO services (name, price, description) VALUES (?, ?, ?);",
          [name, price, description || null]
        );
        res.status(201).json({ message: "Service created" });
        break;
      }
      default:
        res.setHeader("Allow", ["GET", "POST"]);
        res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ API Error (services):", err.message);
    res.status(500).json({ error: err.message });
  }
}
