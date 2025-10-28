import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await client.execute("SELECT * FROM integrations;");
      res.status(200).json(result.rows);
    } else if (req.method === "POST") {
      const { name, type, api_key } = req.body;
      const query = "INSERT INTO integrations (name, type, api_key) VALUES (?, ?, ?);";
      await client.execute(query, [name, type, api_key]);
      res.status(201).json({ message: "Integration added successfully" });
    } else {
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
