import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await client.execute("SELECT * FROM appointments;");
      return res.status(200).json(result.rows);

    } else if (req.method === "POST") {
      const { clinic_id, patient_id, service_id, staff_id, appointment_date, status } = req.body;
      const result = await client.execute(
        "INSERT INTO appointments (clinic_id, patient_id, service_id, staff_id, appointment_date, status) VALUES (?, ?, ?, ?, ?, ?);",
        [clinic_id, patient_id, service_id, staff_id, appointment_date, status]
      );
      return res.status(201).json({ appointment_id: result.lastInsertRowid });

    } else if (req.method === "PUT") {
      const { appointment_id, status, appointment_date } = req.body;
      await client.execute(
        "UPDATE appointments SET status=?, appointment_date=? WHERE appointment_id=?;",
        [status, appointment_date, appointment_id]
      );
      return res.status(200).json({ message: "Updated" });

    } else if (req.method === "DELETE") {
      const { appointment_id } = req.body;
      await client.execute("DELETE FROM appointments WHERE appointment_id=?;", [appointment_id]);
      return res.status(200).json({ message: "Deleted" });

    } else {
      res.status(405).json({ error: "Method not allowed" });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
}
