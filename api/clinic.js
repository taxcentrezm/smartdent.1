// api/clinic.js
import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      // Fetch all clinics
      const result = await client.execute("SELECT * FROM clinics;");
      const clinics = result.rows.map(row => ({
        clinic_id: row.clinic_id,
        name: row.name,
        address: row.address,
        phone: row.phone,
        email: row.email,
        created_at: row.created_at
      }));
      res.status(200).json(clinics);

    } else if (req.method === "POST") {
      // Add a new clinic
      const { name, address, phone, email } = req.body;
      const result = await client.execute(
        "INSERT INTO clinics (name, address, phone, email) VALUES (?, ?, ?, ?);",
        [name, address, phone, email]
      );
      res.status(201).json({ clinic_id: result.lastInsertRowid });

    } else if (req.method === "PUT") {
      // Update clinic details
      const { clinic_id, name, address, phone, email } = req.body;
      await client.execute(
        "UPDATE clinics SET name=?, address=?, phone=?, email=? WHERE clinic_id=?;",
        [name, address, phone, email, clinic_id]
      );
      res.status(200).json({ message: "Clinic updated" });

    } else if (req.method === "DELETE") {
      // Delete a clinic
      const { clinic_id } = req.body;
      await client.execute(
        "DELETE FROM clinics WHERE clinic_id=?;",
        [clinic_id]
      );
      res.status(200).json({ message: "Clinic deleted" });

    } else {
      res.status(405).json({ error: "Method not allowed" });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
}
