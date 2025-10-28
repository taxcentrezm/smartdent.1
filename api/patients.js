import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await client.execute("SELECT * FROM patients;");
      res.status(200).json(result.rows);
    } else if (req.method === "POST") {
      const { name, age, phone } = req.body;
      const query = "INSERT INTO patients (name, age, phone) VALUES (?, ?, ?);";
      await client.execute(query, [name, age, phone]);
      res.status(201).json({ message: "Patient added successfully" });
    } else {
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
