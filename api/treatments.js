import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await client.execute("SELECT * FROM treatments;");
      return res.status(200).json(result.rows);

    } else if (req.method === "POST") {
      const { clinic_id, patient_id, service_id, staff_id, treatment_date, notes, cost } = req.body;
      const result = await client.execute(
        "INSERT INTO treatments (clinic_id, patient_id, service_id, staff_id, treatment_date, notes, cost) VALUES (?, ?, ?, ?, ?, ?, ?);",
        [clinic_id, patient_id, service_id, staff_id, treatment_date, notes, cost]
      );
      return res.status(201).json({ treatment_id: result.lastInsertRowid });

    } else if (req.method === "PUT") {
      const { treatment_id, notes, cost } = req.body;
      await client.execute(
        "UPDATE treatments SET notes=?, cost=? WHERE treatment_id=?;",
        [notes, cost, treatment_id]
      );
      return res.status(200).json({ message: "Updated" });

    } else if (req.method === "DELETE") {
      const { treatment_id } = req.body;
      await client.execute("DELETE FROM treatments WHERE treatment_id=?;", [treatment_id]);
      return res.status(200).json({ message: "Deleted" });

    } else {
      res.status(405).json({ error: "Method not allowed" });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
}
