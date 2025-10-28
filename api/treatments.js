import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await client.execute("SELECT * FROM treatments;");
      res.status(200).json(result.rows);
    } else if (req.method === "POST") {
      const { patient_id, service_id, date, notes } = req.body;
      const query = "INSERT INTO treatments (patient_id, service_id, date, notes) VALUES (?, ?, ?, ?);";
      await client.execute(query, [patient_id, service_id, date, notes]);
      res.status(201).json({ message: "Treatment added successfully" });
    } else {
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
