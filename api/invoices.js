import { client } from "../db.js";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  try {
    switch (req.method) {
      case "GET": {
        const result = await client.execute(
          "SELECT * FROM invoices ORDER BY date DESC;"
        );
        return res.status(200).json({
          message: `✅ ${result.rows.length} invoices fetched`,
          data: result.rows,
        });
      }

      case "POST": {
        const {
          clinic_id,
          patient_id,
          full_name,
          service_id,
          service_name,
          treatment_id,
          treatment_name,
          quantity = 1,
          cost,
          date,
          phone,
          email,
          dob,
          gender,
        } = req.body;

        // 1️⃣ Validate required fields
        if (!clinic_id || !cost || !date) {
          return res.status(400).json({
            error: "Missing required fields: clinic_id, cost, or date",
          });
        }

        // 2️⃣ Validate patient name
        let patientFullName = (full_name || "").trim();
        if (!patientFullName) {
          return res.status(400).json({
            error: "Patient full_name is required and cannot be blank",
          });
        }

        // 3️⃣ Ensure patient exists or create new one
        let finalPatientId = patient_id;
        try {
          if (!finalPatientId || finalPatientId === "new") {
            finalPatientId = randomUUID();
          }

          const existingPatient = await client.execute(
            "SELECT * FROM patients WHERE patient_id = ?;",
            [finalPatientId]
          );

          if (existingPatient.rows.length === 0) {
            await client.execute(
              `INSERT INTO patients (
                patient_id, clinic_id, full_name, phone, email, dob, gender, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'));`,
              [
                finalPatientId,
                clinic_id,
                patientFullName,
                phone || null,
                email || null,
                dob || null,
                gender || null,
              ]
            );
          } else {
            patientFullName = existingPatient.rows[0].full_name;
          }
        } catch (err) {
          return res.status(500).json({
            error: "Failed to ensure patient exists",
            details: err.message,
          });
        }

        // 4️⃣ Create appointment
        try {
          await client.execute(
            "INSERT INTO appointments (clinic_id, patient_id, date, status) VALUES (?, ?, ?, ?);",
            [clinic_id, finalPatientId, date, "Scheduled"]
          );
        } catch (err) {
          return res.status(500).json({
            error: "Failed to create appointment",
            details: err.message,
          });
        }

        // 5️⃣ Ensure treatment exists
        if (treatment_id && treatment_name) {
          try {
            const existingTreatment = await client.execute(
              "SELECT * FROM treatments WHERE treatment_id = ?;",
              [treatment_id]
            );

            if (existingTreatment.rows.length === 0) {
              await client.execute(
                "INSERT INTO treatments (treatment_id, name, service_id, price) VALUES (?, ?, ?, ?);",
                [treatment_id, treatment_name, service_id || null, cost]
              );
            }
          } catch (err) {
            console.error("❌ Treatment error:", err.message);
          }
        }

        // 6️⃣ Deduct stock
        if (treatment_name && quantity > 0) {
          try {
            const stockItem = await client.execute(
              "SELECT * FROM stock WHERE item = ? AND clinic_id = ?;",
              [treatment_name, clinic_id]
            );

            if (stockItem.rows.length > 0) {
              const currentQty = stockItem.rows[0].quantity;
              if (currentQty >= quantity) {
                await client.execute(
                  "UPDATE stock SET quantity = ? WHERE item = ? AND clinic_id = ?;",
                  [currentQty - quantity, treatment_name, clinic_id]
                );
              }
            }
          } catch (err) {
            console.error("❌ Stock deduction failed:", err.message);
          }
        }

        // 7️⃣ Ensure service exists
        if (service_id && service_name) {
          try {
            const existingService = await client.execute(
              "SELECT * FROM services WHERE service_id = ?;",
              [service_id]
            );

            if (existingService.rows.length === 0) {
              await client.execute(
                "INSERT INTO services (service_id, clinic_id, name, price) VALUES (?, ?, ?, ?);",
                [service_id, clinic_id, service_name, cost]
              );
            }
          } catch (err) {
            console.error("❌ Service creation failed:", err.message);
          }
        }

        // 8️⃣ Create invoice
        try {
          const invoice_id = randomUUID();
          const total = cost * quantity;

          await client.execute(
            `INSERT INTO invoices (
              invoice_id, clinic_id, patient_id, full_name,
              service_id, service_name, treatment_id, treatment_name,
              quantity, total, status, date, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              invoice_id,
              clinic_id,
              finalPatientId,
              patientFullName,
              service_id || null,
              service_name || null,
              treatment_id || null,
              treatment_name || null,
              quantity,
              total,
              "Invoice",
              date,
              new Date().toISOString(),
            ]
          );

          return res.status(201).json({
            message: "Invoice created successfully",
            invoice_id,
            patient_id: finalPatientId,
          });
        } catch (err) {
          return res.status(500).json({
            error: "Failed to create invoice",
            details: err.message,
          });
        }
      }

      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).json({
          error: `Method ${req.method} not allowed`,
        });
    }
  } catch (err) {
    return res.status(500).json({
      error: "Unexpected server error",
      details: err.message,
    });
  }
}
