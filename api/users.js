import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await client.execute("SELECT * FROM users;");
      res.status(200).json(result.rows);
    } else if (req.method === "POST") {
      const { name, email, role, password } = req.body;
      const query = "INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?);";
      await client.execute(query, [name, email, role, password]);
      res.status(201).json({ message: "User added successfully" });
    } else {
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
