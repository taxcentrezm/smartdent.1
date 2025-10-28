import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    switch (req.method) {
      case "GET": {
        const result = await client.execute("SELECT * FROM integrations;");
        res.status(200).json(result.rows);
        break;
      }
      case "POST": {
        const { name, type, api_key } = req.body;
        if (!name || !type) {
          return res.status(400).json({ error: "name and type are required." });
        }
        await client.execute(
          "INSERT INTO integrations (name, type, api_key) VALUES (?, ?, ?);",
          [name, type, api_key || null]
        );
        res.status(201).json({ message: "Integration created" });
        break;
      }
      default:
        res.setHeader("Allow", ["GET", "POST"]);
        res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ API Error (integrations):", err.message);
    res.status(500).json({ error: err.message });
  }
}
