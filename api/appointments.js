import { client } from "../db.js"; // adjust path if needed
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  const { method } = req;
  const body = req.body || {};

  try {
    if (method === "GET") {
      const result = await client.execute(`
        SELECT * FROM appointments
WHERE appointment_date > CURRENT_DATE
ORDER BY appointment_date ASC;
      `);
      return res.status(200).json({ data: result.rows });
    }

    if (method === "POST") {
      const {
        clinic_id,
        patient_id,
        service_id,
        dentist_id = null,
        appointment_date,
        status = "Scheduled",
        staff_id
      } = body;

      if (!clinic_id || !patient_id || !service_id || !appointment_date || !staff_id) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const appointment_id = randomUUID();
      const created_at = new Date().toISOString().replace("T", " ").slice(0, 19);

      await client.execute(
        `INSERT INTO appointments (
          appointment_id, clinic_id, patient_id, service_id,
          dentist_id, appointment_date, status, created_at, staff_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          appointment_id,
          clinic_id,
          patient_id,
          service_id,
          dentist_id,
          appointment_date,
          status,
          created_at,
          staff_id
        ]
      );

      return res.status(200).json({ message: "Appointment created", appointment_id });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: `Method ${method} not allowed` });
  } catch (err) {
    console.error("❌ Appointment API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
