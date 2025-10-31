import { client } from "../db.js";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  try {
    switch (req.method) {
      // =====================================================
      // GET: Fetch all invoices
      // =====================================================
      case "GET": {
        console.log("📥 Fetching all invoices...");
        const result = await client.execute(
          "SELECT * FROM invoices ORDER BY date DESC;"
        );

        return res.status(200).json({
          message: `✅ ${result.rows.length} invoices fetched`,
          data: result.rows,
        });
      }

      // =====================================================
      // POST: Create new invoice
      // =====================================================
      case "POST": {
        console.log("📥 Creating new invoice...");

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
        } = req.body;

        // 1️⃣ Validate required fields
        if (!clinic_id || !patient_id || !cost || !date) {
          return res.status(400).json({
            error: "Required fields missing: clinic_id, patient_id, cost, or date",
          });
        }

        // 2️⃣ Ensure patient exists or create
        let patientFullName = full_name || "Unknown";
        try {
          const existingPatient = await client.execute(
            "SELECT * FROM patients WHERE patient_id = ?;",
            [patient_id]
          );

          if (existingPatient.rows.length === 0) {
            await client.execute(
              "INSERT INTO patients (patient_id, full_name, clinic_id) VALUES (?, ?, ?);",
              [patient_id, patientFullName, clinic_id]
            );
            console.log(`✅ Patient created: ${patientFullName}`);
          } else {
            patientFullName = existingPatient.rows[0].full_name;
          }
        } catch (err) {
          return res.status(500).json({ error: "Failed to ensure patient exists", details: err.message });
        }

        // 3️⃣ Create appointment
        try {
          await client.execute(
            "INSERT INTO appointments (clinic_id, patient_id, date, status) VALUES (?, ?, ?, ?);",
            [clinic_id, patient_id, date, "Scheduled"]
          );
          console.log("✅ Appointment created");
        } catch (err) {
          return res.status(500).json({ error: "Failed to create appointment", details: err.message });
        }

        // 4️⃣ Create treatment if not exists
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
              console.log(`✅ Treatment created: ${treatment_name}`);
            }
          } catch (err) {
            return res.status(500).json({ error: "Failed to create treatment", details: err.message });
          }
        }

        // 5️⃣ Deduct stock if exists
        if (treatment_name && quantity > 0) {
          try {
            const stockItem = await client.execute(
              "SELECT * FROM stock WHERE item = ? AND clinic_id = ?;",
              [treatment_name, clinic_id]
            );

            if (stockItem.rows.length > 0) {
              const currentQty = stockItem.rows[0].quantity;
              if (currentQty < quantity) {
                return res.status(400).json({
                  error: `Not enough stock for ${treatment_name}. Available: ${currentQty}`,
                });
              }

              await client.execute(
                "UPDATE stock SET quantity = ? WHERE item = ? AND clinic_id = ?;",
                [currentQty - quantity, treatment_name, clinic_id]
              );
              console.log(`✅ Stock deducted for ${treatment_name}`);
            }
          } catch (err) {
            return res.status(500).json({ error: "Failed to deduct stock", details: err.message });
          }
        }

        // 6️⃣ Record service if not exists
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
              console.log(`✅ Service recorded: ${service_name}`);
            }
          } catch (err) {
            return res.status(500).json({ error: "Failed to record service", details: err.message });
          }
        }

        // 7️⃣ Insert invoice
        try {
          const invoice_id = randomUUID();
          await client.execute(
            `INSERT INTO invoices
              (invoice_id, clinic_id, patient_id, full_name, service_id, service_name, treatment_id, treatment_name, quantity, total, status, date, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              invoice_id,
              clinic_id,
              patient_id,
              patientFullName,
              service_id || null,
              service_name || null,
              treatment_id || null,
              treatment_name || null,
              quantity,
              cost * quantity,
              "Invoice",
              date,
              new Date().toISOString(),
            ]
          );
          console.log(`✅ Invoice created: ${invoice_id}`);
          return res.status(201).json({ message: "Invoice created successfully", invoice_id });
        } catch (err) {
          return res.status(500).json({ error: "Failed to create invoice", details: err.message });
        }
      }

      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ Invoices API failed:", err.message);
    return res.status(500).json({ error: "Unexpected error", details: err.message });
  }
}
