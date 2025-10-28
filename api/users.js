import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    switch (req.method) {
      case "GET": {
        const result = await client.execute("SELECT * FROM users;");
        res.status(200).json(result.rows);
        break;
      }
      case "POST": {
        const { name, email, role, password } = req.body;
        if (!name || !email || !password) {
          return res.status(400).json({ error: "name, email, and password are required." });
        }
        await client.execute(
          "INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?);",
          [name, email, role || "staff", password]
        );
        res.status(201).json({ message: "User created" });
        break;
      }
      default:
        res.setHeader("Allow", ["GET", "POST"]);
        res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ API Error (users):", err.message);
    res.status(500).json({ error: err.message });
  }
}
