import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    const url = req.url || "";
    const isClinical = url.includes("clinical");

    // ================================
    // CLINICAL RECORDS LOGIC
    // ================================
    if (isClinical) {
      switch (req.method) {
        // ---------- FETCH CLINICAL RECORDS ----------
       case "GET": {
  const { patient_id, clinic_id, distinct } = req.query;

  // 1️⃣ Distinct patient list mode
  if (distinct === "patients") {
    const result = await client.execute(`
      SELECT DISTINCT patient_id FROM clinical_records ORDER BY patient_id;
    `);
    return res.status(200).json({ data: result.rows });
  }

  // 2️⃣ Normal record fetch mode
  if (!patient_id) {
    return res.status(400).json({ error: "patient_id is required." });
  }

  const cleanId = patient_id.trim().toLowerCase();
  let query = "SELECT * FROM clinical_records WHERE LOWER(patient_id) = ?";
  const params = [cleanId];

  if (clinic_id) {
    query += " AND clinic_id = ?";
    params.push(clinic_id.trim());
  }

  query += " ORDER BY datetime(created_at) DESC;";
  const result = await client.execute(query, params);

  return res.status(200).json({
    message: `${result.rows.length} records fetched`,
    data: result.rows,
  });
}


        // ---------- CREATE NEW CLINICAL RECORD ----------
        case "POST": {
          const { patient_id, clinic_id, diagnosis, charting, imaging, prescriptions, notes } = req.body;

          if (!patient_id || !clinic_id || !diagnosis) {
            return res.status(400).json({ error: "patient_id, clinic_id, and diagnosis are required." });
          }

          const payload = [
            patient_id.trim(),
            clinic_id.trim(),
            diagnosis.trim(),
            charting || "",
            JSON.stringify(imaging || []),
            JSON.stringify(prescriptions || []),
            notes || "",
          ];

          await client.execute(
            `INSERT INTO clinical_records 
              (patient_id, clinic_id, diagnosis, charting, imaging, prescriptions, notes, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);`,
            payload
          );

          console.log(`✅ Clinical record inserted for patient_id: ${patient_id}`);
          return res.status(201).json({ message: "Clinical record saved successfully." });
        }

        default:
          res.setHeader("Allow", ["GET", "POST"]);
          return res.status(405).json({ error: `Method ${req.method} not allowed for clinical records` });
      }
    }

    // ================================
    // DEFAULT INTEGRATIONS LOGIC
    // ================================
    switch (req.method) {
      case "GET": {
        const result = await client.execute("SELECT * FROM integrations;");
        return res.status(200).json(result.rows);
      }

      case "POST": {
        const { name, type, api_key } = req.body;
        if (!name || !type) {
          return res.status(400).json({ error: "name and type are required." });
        }

        await client.execute(
          "INSERT INTO integrations (name, type, api_key) VALUES (?, ?, ?);",
          [name.trim(), type.trim(), api_key || null]
        );

        console.log(`✅ Integration created: ${name} (${type})`);
        return res.status(201).json({ message: "Integration created" });
      }

      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).json({ error: `Method ${req.method} not allowed for integrations` });
    }
  } catch (err) {
    console.error("❌ API Error (integrations):", err.message);
    return res.status(500).json({ error: err.message });
  }
}
