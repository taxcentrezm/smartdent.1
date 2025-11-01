import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    const url = req.url || "";
    const isClinical = url.includes("clinical");

    // =======================================
    // CLINICAL RECORDS LOGIC
    // =======================================
    if (isClinical) {
      switch (req.method) {
        // -----------------------
        // GET → fetch records
        // -----------------------
        case "GET": {
          const { patient_id, clinic_id, distinct } = req.query;

          // 1️⃣ Distinct patient list mode
          if (distinct === "patients") {
            const result = await client.execute(`
              SELECT DISTINCT cr.patient_id, p.full_name, p.dob
              FROM clinical_records cr
              LEFT JOIN patients p ON TRIM(LOWER(cr.patient_id)) = TRIM(LOWER(p.patient_id))
              ORDER BY cr.patient_id;
            `);

            const enriched = result.rows.map(row => {
              let age = null;
              if (row.dob) {
                const birthDate = new Date(row.dob);
                const today = new Date();
                age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                  age--;
                }
              }

              return {
                patient_id: row.patient_id,
                full_name: row.full_name || row.patient_id,
                age,
              };
            });

            console.log(`📋 Distinct patient list returned: ${enriched.length}`);
            return res.status(200).json({ data: enriched });
          }

          // 2️⃣ Full record fetch mode
          let query = `
            SELECT cr.*, p.full_name, p.dob
            FROM clinical_records cr
            LEFT JOIN patients p ON TRIM(LOWER(cr.patient_id)) = TRIM(LOWER(p.patient_id))
          `;
          const params = [];
          const conditions = [];

          if (patient_id) {
            conditions.push("TRIM(LOWER(cr.patient_id)) = TRIM(LOWER(?))");
            params.push(patient_id.trim().toLowerCase());
          }

          if (clinic_id) {
            conditions.push("cr.clinic_id = ?");
            params.push(clinic_id.trim());
          }

          if (conditions.length) {
            query += " WHERE " + conditions.join(" AND ");
          }

          query += " ORDER BY datetime(cr.created_at) DESC;";
          console.log("🔍 Executing query:", query.trim(), "with params:", params);

          const result = await client.execute(query.trim(), params);

          const enriched = result.rows.map(row => {
            let age = null;
            if (row.dob) {
              const birthDate = new Date(row.dob);
              const today = new Date();
              age = today.getFullYear() - birthDate.getFullYear();
              const m = today.getMonth() - birthDate.getMonth();
              if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
              }
            }

            return {
              ...row,
              full_name: row.full_name || row.patient_id,
              age,
            };
          });

          console.log(`✅ ${enriched.length} clinical records fetched.`);
          return res.status(200).json({
            message: `${enriched.length} record(s) fetched`,
            data: enriched,
          });
        }

        // -----------------------
        // POST → create record
        // -----------------------
        case "POST": {
          const {
            patient_id,
            clinic_id,
            diagnosis,
            charting,
            imaging,
            prescriptions,
            notes,
          } = req.body;

          if (!patient_id || !clinic_id || !diagnosis) {
            console.warn("⚠️ Missing required fields:", { patient_id, clinic_id, diagnosis });
            return res.status(400).json({
              error: "patient_id, clinic_id, and diagnosis are required.",
            });
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

          const query = `
            INSERT INTO clinical_records 
              (patient_id, clinic_id, diagnosis, charting, imaging, prescriptions, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
          `;

          await client.execute(query, payload);
          console.log(`✅ Clinical record inserted for patient_id: ${patient_id}`);

          return res.status(201).json({
            message: "Clinical record saved successfully.",
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
    console.error("❌ API Error (integrations):", err.message);
    return res.status(500).json({ error: err.message });
  }
}
