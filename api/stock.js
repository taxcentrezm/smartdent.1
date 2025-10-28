import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await client.execute("SELECT * FROM stock;");
      res.status(200).json(result.rows);

    } else if (req.method === "POST") {
      const { clinic_id, name, quantity, reorder_level, auto_reorder } = req.body;
      const result = await client.execute(
        "INSERT INTO stock (clinic_id, name, quantity, reorder_level, auto_reorder) VALUES (?, ?, ?, ?, ?);",
        [clinic_id, name, quantity, reorder_level, auto_reorder]
      );
      res.status(201).json({ stock_id: result.lastInsertRowid });

    } else if (req.method === "PUT") {
      const { stock_id, quantity, reorder_level, auto_reorder } = req.body;
      await client.execute(
        "UPDATE stock SET quantity=?, reorder_level=?, auto_reorder=? WHERE stock_id=?;",
        [quantity, reorder_level, auto_reorder, stock_id]
      );
      res.status(200).json({ message: "Updated" });

    } else if (req.method === "DELETE") {
      const { stock_id } = req.body;
      await client.execute("DELETE FROM stock WHERE stock_id=?;", [stock_id]);
      res.status(200).json({ message: "Deleted" });

    } else res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
}
