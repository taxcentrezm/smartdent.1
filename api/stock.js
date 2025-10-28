// api/stock.js
import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    switch (req.method) {
      case "GET": {
        const result = await client.execute("SELECT * FROM stock;");
        res.status(200).json(result.rows);
        break;
      }
      case "POST": {
        const { item, quantity, price } = req.body;

        if (!item || quantity == null || price == null) {
          return res.status(400).json({ error: "item, quantity, and price are required." });
        }

        await client.execute(
          "INSERT INTO stock (item, quantity, price) VALUES (?, ?, ?);",
          [item, quantity, price]
        );

        res.status(201).json({ message: "Stock item created" });
        break;
      }
      default:
        res.setHeader("Allow", ["GET", "POST"]);
        res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ API Error (stock):", err);
    res.status(500).json({ error: err.message });
  }
}
