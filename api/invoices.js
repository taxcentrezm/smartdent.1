import { client } from "../db.js";

export default async function handler(req, res) {
  console.log("📥 Incoming request to /api/invoices");
  console.log("🔍 Request method:", req.method);

  try {
    switch (req.method) {
      case "GET": {
        // Fetch all invoices
        const result = await client.execute("SELECT * FROM invoices ORDER BY date DESC;");
        res.status(200).json({ message: "Invoices fetched successfully", data: result.rows });
        break;
      }

      case "POST": {
        const {
          clinic_id,
          patient_id,
          full_name,
          service_id,
          treatment_name,
          quantity = 1,
          cost,
          date,
          stock_items = [], // array of { item_id, quantity }
          notes = "",
        } = req.body;

        if (!clinic_id || !patient_id || !full_name || !service_id || !treatment_name || !cost || !date) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        // 1️⃣ Ensure patient exists
        const existingPatient = await client.execute(
          "SELECT * FROM patients WHERE patient_id = ?;",
          [patient_id]
        );

        if (existingPatient.rows.length === 0) {
          await client.execute(
            "INSERT INTO patients (patient_id, full_name, clinic_id) VALUES (?, ?, ?);",
            [patient_id, full_name, clinic_id]
          );
          console.log(`✅ Patient ${full_name} created`);
        }

        // 2️⃣ Create appointment
        const appointment_id = `a_${Date.now()}`;
        await client.execute(
          "INSERT INTO appointments (appointment_id, clinic_id, patient_id, service_id, date, notes) VALUES (?, ?, ?, ?, ?, ?);",
          [appointment_id, clinic_id, patient_id, service_id, date, notes]
        );
        console.log(`✅ Appointment created`);

        // 3️⃣ Create treatment
        const treatment_id = `t_${Date.now()}`;
        await client.execute(
          "INSERT INTO treatments (treatment_id, name, service_id, price) VALUES (?, ?, ?, ?);",
          [treatment_id, treatment_name, service_id, cost]
        );
        console.log(`✅ Treatment created`);

        // 4️⃣ Deduct stock
        for (const item of stock_items) {
          const stock = await client.execute("SELECT * FROM stock WHERE item = ?;", [item.item_id]);
          if (stock.rows.length === 0) continue;

          const currentQty = stock.rows[0].quantity;
          const newQty = currentQty - item.quantity;
          if (newQty < 0) {
            return res.status(400).json({ error: `Insufficient stock for ${item.item_id}` });
          }

          await client.execute("UPDATE stock SET quantity = ? WHERE item = ?;", [newQty, item.item_id]);
        }
        console.log("✅ Stock updated");

        // 5️⃣ Record service (optional: could be just linking service to invoice/treatment)

        // 6️⃣ Create invoice
        const invoice_id = `i_${Date.now()}`;
        await client.execute(
          `INSERT INTO invoices 
            (invoice_id, clinic_id, patient_id, full_name, service_id, service_name, treatment_id, treatment_name, quantity, total, status, date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            invoice_id,
            clinic_id,
            patient_id,
            full_name,
            service_id,
            treatment_name, // using treatment_name as service_name for simplicity
            treatment_id,
            treatment_name,
            quantity,
            cost * quantity,
            "Invoice",
            date,
            new Date().toISOString()
          ]
        );
        console.log("✅ Invoice created");

        res.status(201).json({ message: "Invoice, treatment, appointment created successfully", invoice_id });
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
