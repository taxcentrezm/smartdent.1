import { client } from "../db.js";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  try {
    const { method, body } = req;

    if (method === "GET") {
      // =====================================================
      // 1️⃣ GET: Fetch all patients
      // =====================================================
      const result = await client.execute(`
        SELECT 
          patient_id,
          full_name,
          dob,
          (strftime('%Y', 'now') - strftime('%Y', dob)) 
            - (strftime('%m-%d', 'now') < strftime('%m-%d', dob)) AS age,
          phone,
          email,
          notes,
          created_at
        FROM patients
        ORDER BY full_name;
      `);

      console.log(`✅ Retrieved ${result.rows.length} patients`);

      return res.status(200).json({
        message: "Patients fetched successfully",
        data: result.rows.map(p => ({
          patient_id: p.patient_id,
          full_name: p.full_name,
          dob: p.dob,
          age: p.age,
          phone: p.phone,
          email: p.email,
          notes: p.notes,
        })),
      });
    }

    if (method === "POST") {
      // =====================================================
      // 2️⃣ POST: Create new patient
      // =====================================================
      const { full_name, dob, phone, email, notes } = body || {};

      if (!full_name || !phone) {
        return res.status(400).json({
          error: "Full name and phone are required.",
        });
      }

      let age = null;
      if (dob) {
        const birthDate = new Date(dob);
        const today = new Date();
        age =
          today.getFullYear() -
          birthDate.getFullYear() -
          (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0);
      }

      const patient_id = randomUUID();

      await client.execute(
        `INSERT INTO patients (
          patient_id, full_name, dob, age, phone, email, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [patient_id, full_name, dob || null, age, phone, email || null, notes || null]
      );

      console.log(`✅ Patient created: ${full_name}`);

      return res.status(201).json({
        message: "Patient created successfully",
        patient_id,
        age,
      });
    }

    // =====================================================
    // 3️⃣ Unsupported Method
    // =====================================================
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({
      error: `Method ${method} not allowed`,
    });

  } catch (err) {
    console.error("❌ Patient API error:", err.message);
    return res.status(500).json({
      error: "Internal server error",
      details: err.message,
    });
  }
}
