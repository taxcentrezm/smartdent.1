import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    const url = req.url || "";
    const isClinical = url.includes("clinical");

    // ================================
    // CLINICAL LOGIC
    // ================================
    if (isClinical) {
      switch (req.method) {
        case "GET": {
          const { patient_id } = req.query;
          if (!patient_id) {
            return res.status(400).json({ error: "patient_id is required." });
          }

          const result = await client.execute(
            "SELECT * FROM clinical WHERE patient_id = ? ORDER BY created_at DESC;",
            [patient_id]
          );
          return res.status(200).json(result.rows);
        }

        case "POST": {
          const { patient_id, charting_notes, imaging, prescriptions } = req.body;

          if (!patient_id) {
            return res.status(400).json({ error: "patient_id is required." });
          }

          await client.execute(
            `INSERT INTO clinical (patient_id, charting_notes, imaging, prescriptions, created_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP);`,
            [
              patient_id,
              charting_notes || "",
              JSON.stringify(imaging || []),
              JSON.stringify(prescriptions || []),
            ]
          );

          return res
            .status(201)
            .json({ message: "Clinical record saved successfully." });
        }

        default:
          res.setHeader("Allow", ["GET", "POST"]);
          return res
            .status(405)
            .json({ error: `Method ${req.method} not allowed for clinical` });
      }
    }

    // ================================
    // INTEGRATIONS LOGIC (DEFAULT)
    // ================================
    switch (req.method) {
      case "GET": {
        const result = await client.execute("SELECT * FROM integrations;");
        res.status(200).json(result.rows);
        break;
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

        res.status(201).json({ message: "Integration created" });
        break;
      }

      default:
        res.setHeader("Allow", ["GET", "POST"]);
        res
          .status(405)
          .json({ error: `Method ${req.method} not allowed for integrations` });
    }
  } catch (err) {
    console.error("❌ API Error (integrations):", err.message);
    res.status(500).json({ error: err.message });
  }
}
