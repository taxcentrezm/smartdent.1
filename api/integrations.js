import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await client.execute("SELECT * FROM integrations;");
      res.status(200).json(result.rows);

    } else if (req.method === "POST") {
      const { clinic_id, type, key, settings } = req.body;
      const result = await client.execute(
        "INSERT INTO integrations (clinic_id, type, key, settings) VALUES (?, ?, ?, ?);",
        [clinic_id, type, key, JSON.stringify(settings)]
      );
      res.status(201).json({ integration_id: result.lastInsertRowid });

    } else if (req.method === "PUT") {
      const { integration_id, key, settings } = req.body;
      await client.execute(
        "UPDATE integrations SET key=?, settings=? WHERE integration_id=?;",
        [key, JSON.stringify(settings), integration_id]
      );
      res.status(200).json({ message: "Updated" });

    } else if (req.method === "DELETE") {
      const { integration_id } = req.body;
      await client.execute("DELETE FROM integrations WHERE integration_id=?;", [integration_id]);
      res.status(200).json({ message: "Deleted" });

    } else res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
}
