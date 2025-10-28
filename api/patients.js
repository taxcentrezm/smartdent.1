// api/patients.js
import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    switch (req.method) {
      // GET all patients
      case "GET": {
        const result = await client.execute("SELECT * FROM patients;");
        res.status(200).json(result.rows);
        break;
      }

      // POST a new patient
      case "POST": {
        const { name, age, phone, email, notes } = req.body;

        if (!name || !phone) {
          return res.status(400).json({ error: "Name and phone are required." });
        }

        const result = await client.execute(
          "INSERT INTO patients (name, age, phone, email, notes) VALUES (?, ?, ?, ?, ?);",
          [name, age || null, phone, email || null, notes || null]
        );

        res.status(201).json({ message: "Patient created", id: result.lastInsertRowid });
        break;
      }

      // Other HTTP methods
      default:
        res.setHeader("Allow", ["GET", "POST"]);
        res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ API Error (patients):", err);
    res.status(500).json({ error: err.message });
  }
}
