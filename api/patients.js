import { client } from "../db.js";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  try {
    switch (req.method) {
      // =====================================================
      // 1️⃣ GET: Fetch all patients (for dropdowns)
      // =====================================================
      case "GET": {
        const result = await client.execute(`
          SELECT 
            patient_id,
            full_name,
            dob,
            (strftime('%Y', 'now') - strftime('%Y', dob)) 
              - (strftime('%m-%d', 'now') < strftime('%m-%d', dob)) 
              AS age,
            phone,
            email,
            notes,
            created_at
          FROM patients
          ORDER BY full_name;
        `);

        console.log("✅ Patients fetched:", result.rows.length);

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

      // =====================================================
      // 2️⃣ POST: Add new patient
      // =====================================================
      case "POST": {
        const { full_name, dob, phone, email, notes } = req.body;

        if (!full_name || !phone) {
          return res
            .status(400)
            .json({ error: "Full name and phone are required." });
        }

        // 🧮 Calculate age from DOB if provided
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
          `INSERT INTO patients 
            (patient_id, full_name, dob, age, phone, email, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [patient_id, full_name, dob || null, age || null, phone, email || null, notes || null]
        );

        console.log("✅ New patient created:", full_name);

        return res.status(201).json({
          message: "Patient created successfully",
          patient_id,
          age,
        });
      }

      // =====================================================
      // 3️⃣ INVALID METHOD
      // =====================================================
      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res
          .status(405)
          .json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ API Error (patients):", err.message);
    return res.status(500).json({ error: err.message });
  }
}
