import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await client.execute("SELECT * FROM users;");
      res.status(200).json(result.rows);

    } else if (req.method === "POST") {
      const { clinic_id, full_name, email, password, role } = req.body;
      const result = await client.execute(
        "INSERT INTO users (clinic_id, full_name, email, password, role) VALUES (?, ?, ?, ?, ?);",
        [clinic_id, full_name, email, password, role]
      );
      res.status(201).json({ user_id: result.lastInsertRowid });

    } else if (req.method === "PUT") {
      const { user_id, full_name, email, role } = req.body;
      await client.execute(
        "UPDATE users SET full_name=?, email=?, role=? WHERE user_id=?;",
        [full_name, email, role, user_id]
      );
      res.status(200).json({ message: "Updated" });

    } else if (req.method === "DELETE") {
      const { user_id } = req.body;
      await client.execute("DELETE FROM users WHERE user_id=?;", [user_id]);
      res.status(200).json({ message: "Deleted" });

    } else res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
}
