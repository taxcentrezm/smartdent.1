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
        case "GET": {
          const { patient_id, clinic_id, export: exportType } = req.query;
          if (!patient_id) {
            return res.status(400).json({ error: "patient_id is required." });
          }

          let query = "SELECT * FROM clinical_records WHERE patient_id = ?";
          const params = [patient_id];

          if (clinic_id) {
            query += " AND clinic_id = ?";
            params.push(clinic_id);
          }

          query += " ORDER BY datetime(created_at) DESC;";
          const result = await client.execute(query, params);

      

          // JSON response
          return res.status(200).json({
            message: `${result.rows.length} records fetched`,
            data: result.rows,
          });
        }

        case "POST": {
          const { patient_id, clinic_id, diagnosis, charting, imaging, prescriptions, notes } = req.body;

          if (!patient_id || !clinic_id || !diagnosis) {
            return res.status(400).json({ error: "patient_id, clinic_id, and diagnosis are required." });
          }

          await client.execute(
            `INSERT INTO clinical_records 
              (patient_id, clinic_id, diagnosis, charting, imaging, prescriptions, notes, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);`,
            [
              patient_id,
              clinic_id,
              diagnosis,
              charting || "",
              JSON.stringify(imaging || []),
              JSON.stringify(prescriptions || []),
              notes || "",
            ]
          );

          return res.status(201).json({ message: "Clinical record saved successfully." });
        }

        default:
          res.setHeader("Allow", ["GET", "POST"]);
          return res.status(405).json({ error: `Method ${req.method} not allowed for clinical records` });
      }
    }

    // ================================
    // DEFAULT: INTEGRATIONS LOGIC
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
          [name, type, api_key || null]
        );

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
