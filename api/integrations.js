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
          const { patient_id, clinic_id } = req.query;

          let query = "SELECT * FROM clinical_records";
          const params = [];

          if (patient_id) {
            query += " WHERE LOWER(patient_id) = ?";
            params.push(patient_id.trim().toLowerCase());
          }

          if (clinic_id) {
            query += patient_id ? " AND" : " WHERE";
            query += " clinic_id = ?";
            params.push(clinic_id.trim());
          }

          query += " ORDER BY datetime(created_at) DESC;";
          console.log("🔍 Executing query:", query, "with params:", params);

          const result = await client.execute(query, params);
          console.log(`✅ ${result.rows.length} clinical records fetched.`);

          return res.status(200).json({
            message: `${result.rows.length} record(s) fetched`,
            data: result.rows,
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
          return res
            .status(405)
            .json({ error: `Method ${req.method} not allowed for clinical records` });
      }
    }

    // =======================================
    // INTEGRATIONS LOGIC (Default)
    // =======================================
    switch (req.method) {
      // -----------------------
      // GET → fetch integrations
      // -----------------------
      case "GET": {
        const result = await client.execute("SELECT * FROM integrations;");
        return res.status(200).json({ data: result.rows });
      }

      // -----------------------
      // POST → create integration
      // -----------------------
      case "POST": {
        const { name, type, api_key } = req.body;

        if (!name || !type) {
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
        return res
          .status(405)
          .json({ error: `Method ${req.method} not allowed for integrations` });
    }
  } catch (err) {
    console.error("❌ API Error (integrations):", err.message);
    return res.status(500).json({ error: err.message });
  }
}
