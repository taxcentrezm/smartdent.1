import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await client.execute("SELECT * FROM clinic;");
      res.status(200).json(result.rows);
    } else if (req.method === "POST") {
      const { name, address, phone } = req.body;
      const query = "INSERT INTO clinic (name, address, phone) VALUES (?, ?, ?);";
      await client.execute(query, [name, address, phone]);
      res.status(201).json({ message: "Clinic added successfully" });
    } else {
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
