// api/appointments.js
import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    switch (req.method) {
      case "GET": {
        const result = await client.execute("SELECT * FROM appointments;");
        res.status(200).json(result.rows);
        break;
      }
      case "POST": {
        const { patient_id, date, time, notes } = req.body;

        if (!patient_id || !date || !time) {
          return res.status(400).json({ error: "patient_id, date, and time are required." });
        }

        const result = await client.execute(
          "INSERT INTO appointments (patient_id, date, time, notes) VALUES (?, ?, ?, ?);",
          [patient_id, date, time, notes || null]
        );

        res.status(201).json({ message: "Appointment created", id: result.lastInsertRowid });
        break;
      }
      default:
        res.setHeader("Allow", ["GET", "POST"]);
        res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ API Error (appointments):", err);
    res.status(500).json({ error: err.message });
  }
}
