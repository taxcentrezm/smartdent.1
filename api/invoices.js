import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    switch (req.method) {
      case "GET": {
        console.log("📥 Fetching all invoices...");
        const result = await client.execute("SELECT * FROM invoices ORDER BY date DESC;");
        res.status(200).json({
          message: "Invoices fetched successfully",
          data: result.rows
        });
        break;
      }

      case "POST": {
        console.log("📥 Creating new invoice...");

        const {
          clinic_id,
          patient_id,
          patient_name,
          service_id,
          service_name,
          treatment_id,
          treatment_name,
          quantity = 1,
          cost,
          date
        } = req.body;

        if (!clinic_id || !patient_id || !service_id || !treatment_id || !cost || !date) {
          return res.status(400).json({ error: "Required fields missing" });
        }

        // 1️⃣ Ensure patient exists
        let fullName = patient_name;
        const existingPatient = await client.execute(
          "SELECT * FROM patients WHERE patient_id = ?;",
          [patient_id]
        );

        if (existingPatient.rows.length === 0) {
          await client.execute(
            "INSERT INTO patients (patient_id, full_name, clinic_id) VALUES (?, ?, ?);",
            [patient_id, patient_name || "Unknown", clinic_id]
          );
          console.log(`✅ Patient created: ${patient_name}`);
        } else {
          fullName = existingPatient.rows[0].full_name;
        }

        // 2️⃣ Create appointment for this patient
        await client.execute(
          "INSERT INTO appointments (clinic_id, patient_id, date, status) VALUES (?, ?, ?, ?);",
          [clinic_id, patient_id, date, "Scheduled"]
        );
        console.log("✅ Appointment created");

        // 3️⃣ Create treatment record if not exists
        const existingTreatment = await client.execute(
          "SELECT * FROM treatments WHERE treatment_id = ?;",
          [treatment_id]
        );

        if (existingTreatment.rows.length === 0) {
          await client.execute(
            "INSERT INTO treatments (treatment_id, name, service_id, price) VALUES (?, ?, ?, ?);",
            [treatment_id, treatment_name, service_id, cost]
          );
          console.log("✅ Treatment created");
        }

        // 4️⃣ Deduct stock if treatment requires items (simplified example)
        // You can extend this to match actual stock items per treatment
        const stockItem = await client.execute(
          "SELECT * FROM stock WHERE item = ? AND clinic_id = ?;",
          [treatment_name, clinic_id]
        );

        if (stockItem.rows.length > 0 && stockItem.rows[0].quantity >= quantity) {
          const newQty = stockItem.rows[0].quantity - quantity;
          await client.execute(
            "UPDATE stock SET quantity = ? WHERE item = ? AND clinic_id = ?;",
            [newQty, treatment_name, clinic_id]
          );
          console.log(`✅ Stock deducted for ${treatment_name}`);
        }

        // 5️⃣ Record the service if not exists
        const existingService = await client.execute(
          "SELECT * FROM services WHERE service_id = ?;",
          [service_id]
        );

        if (existingService.rows.length === 0) {
          await client.execute(
            "INSERT INTO services (service_id, clinic_id, name, price) VALUES (?, ?, ?, ?);",
            [service_id, clinic_id, service_name, cost]
          );
          console.log("✅ Service recorded");
        }

        // 6️⃣ Insert invoice
        await client.execute(
          `INSERT INTO invoices
            (clinic_id, patient_id, full_name, service_id, service_name, treatment_id, treatment_name, quantity, total, status, date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            clinic_id,
            patient_id,
            fullName,
            service_id,
            service_name,
            treatment_id,
            treatment_name,
            quantity,
            cost * quantity,
            "Invoice",
            date,
            new Date().toISOString()
          ]
        );

        console.log("✅ Invoice created successfully");

        res.status(201).json({ message: "Invoice created successfully" });
        break;
      }

      default:
        res.setHeader("Allow", ["GET", "POST"]);
        res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ Invoices API failed:", err.message);
    res.status(500).json({ error: err.message });
  }
}
