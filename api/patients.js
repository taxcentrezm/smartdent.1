import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await client.execute("SELECT * FROM patients;");
      const patients = result.rows.map(row => ({
        patient_id: row.patient_id,
        clinic_id: row.clinic_id,
        full_name: row.full_name,
        email: row.email,
        phone: row.phone,
        dob: row.dob
      }));
      return res.status(200).json(patients);

    } else if (req.method === "POST") {
      const { clinic_id, full_name, email, phone, dob } = req.body;
      const result = await client.execute(
        "INSERT INTO patients (clinic_id, full_name, email, phone, dob) VALUES (?, ?, ?, ?, ?);",
        [clinic_id, full_name, email, phone, dob]
      );
      return res.status(201).json({ patient_id: result.lastInsertRowid });

    } else if (req.method === "PUT") {
      const { patient_id, full_name, email, phone, dob } = req.body;
      await client.execute(
        "UPDATE patients SET full_name=?, email=?, phone=?, dob=? WHERE patient_id=?;",
        [full_name, email, phone, dob, patient_id]
      );
      return res.status(200).json({ message: "Updated" });

    } else if (req.method === "DELETE") {
      const { patient_id } = req.body;
      await client.execute("DELETE FROM patients WHERE patient_id=?;", [patient_id]);
      return res.status(200).json({ message: "Deleted" });

    } else {
      res.status(405).json({ error: "Method not allowed" });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
}
