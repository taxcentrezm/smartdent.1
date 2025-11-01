import { client } from "../db.js";

function calculateAge(dob) {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export default async function handler(req, res) {
  try {
    const url = req.url || "";
    const isClinical = url.includes("clinical");

    // =======================================
    // CLINICAL RECORDS ENRICHED LOGIC
    // =======================================
    if (isClinical) {
      switch (req.method) {
        // -----------------------
        // GET → fetch records
        // -----------------------
        case "GET": {
          const { patient_id, clinic_id, record_id, name_only } = req.query;
          let query = `SELECT * FROM clinical_records_enriched`;
          const params = [];
          const conditions = [];

          if (record_id && name_only === "true") {
            query = `SELECT full_name FROM clinical_records_enriched WHERE TRIM(LOWER(record_id)) = TRIM(LOWER(?)) LIMIT 1;`;
            params.push(record_id.trim().toLowerCase());
            const result = await client.execute(query, params);
            const name = result.rows[0]?.full_name || null;
            return res.status(200).json({ full_name: name });
          }

          if (patient_id) {
            conditions.push("TRIM(LOWER(patient_id)) = TRIM(LOWER(?))");
            params.push(patient_id.trim().toLowerCase());
          }

          if (clinic_id) {
            conditions.push("clinic_id = ?");
            params.push(clinic_id.trim());
          }

          if (conditions.length) {
            query += " WHERE " + conditions.join(" AND ");
          }

          query += " ORDER BY datetime(created_at) DESC;";
          console.log("🔍 Executing query:", query.trim(), "with params:", params);

          const result = await client.execute(query.trim(), params);
          console.log(`✅ ${result.rows.length} enriched records fetched.`);
          return res.status(200).json({
            message: `${result.rows.length} record(s) fetched`,
            data: result.rows,
          });
        }

        // -----------------------
        // POST → create enriched record
        // -----------------------
        case "POST": {
          const {
            patient_id,
            full_name,
            dob,
            gender,
            phone,
            email,
            clinic_id,
            diagnosis,
            charting,
            prescriptions,
            notes,
            created_at,
          } = req.body;

          if (!patient_id || !full_name || !dob || !clinic_id || !diagnosis) {
            console.warn("⚠️ Missing required fields:", {
              patient_id, full_name, dob, clinic_id, diagnosis
            });
            return res.status(400).json({
              error: "patient_id, full_name, dob, clinic_id, and diagnosis are required.",
            });
          }

          const age = calculateAge(dob);
          const record_id = `r-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

          const payload = [
            record_id,
            patient_id.trim(),
            full_name.trim(),
            dob,
            age,
            gender || "",
            phone || "",
            email || "",
            clinic_id.trim(),
            diagnosis.trim(),
            charting || "",
            JSON.stringify(prescriptions || []),
            notes || "",
            created_at || new Date().toISOString(),
          ];

          const query = `
            INSERT INTO clinical_records_enriched (
              record_id, patient_id, full_name, dob, age, gender, phone, email, clinic_id,
              diagnosis, charting, prescriptions, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `;

          await client.execute(query, payload);
          console.log(`✅ Enriched record created for patient_id: ${patient_id}`);

          return res.status(201).json({
            message: "Enriched clinical record saved successfully.",
            record_id,
          });
        }

        default:
          res.setHeader("Allow", ["GET", "POST"]);
          return res.status(405).json({ error: `Method ${req.method} not allowed for clinical records` });
      }
    }

    // =======================================
    // INTEGRATIONS LOGIC (Default)
    // =======================================
    switch (req.method) {
      case "GET": {
        const result = await client.execute("SELECT * FROM integrations;");
        return res.status(200).json({ data: result.rows });
      }

      case "POST": {
        const { name, type, api_key } = req.body;

        if (!name || !type) {
          console.warn("⚠️ Missing integration fields:", { name, type });
          return res.status(400).json({
            error: "name and type are required.",
          });
        }

        const query = `
          INSERT INTO integrations (name, type, api_key)
          VALUES (?, ?, ?);
        `;

        await client.execute(query, [name.trim(), type.trim(), api_key || null]);
        console.log(`✅ Integration created: ${name} (${type})`);

        return res.status(201).json({ message: "Integration created successfully." });
      }

      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).json({ error: `Method ${req.method} not allowed for integrations` });
    }
  } catch (err) {
    console.error("❌ API Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
