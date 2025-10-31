import { client } from "../db.js";
import { randomUUID } from "crypto";

// /api/services.js
export default async function handler(req, res) {
  console.log("📥 Incoming request to /api/services");
  console.log("🔍 Method:", req.method);

  try {
    // =====================================
    // 1️⃣ FETCH SERVICES
    // =====================================
    if (req.method === "GET") {
      const result = await client.execute(
        "SELECT * FROM services WHERE clinic_id = 1;"
      );

      console.log("✅ Services fetched:", result.rows.length);
      return res.status(200).json({
        message: "Services fetched successfully",
        data: result.rows,
      });
    }

    // =====================================
    // 2️⃣ ADD SERVICE + AUTO-INVOICE
    // =====================================
    if (req.method === "POST") {
      const { clinic_id = 1, name, description, price, patient_id } = req.body;

      if (!name || !price)
        return res
          .status(400)
          .json({ error: "Missing required fields: name or price" });

      // 2️⃣.1 Create service
      const service_id = randomUUID();
      await client.execute(
        `INSERT INTO services (service_id, clinic_id, name, description, price)
         VALUES (?, ?, ?, ?, ?)`,
        [service_id, clinic_id, name, description || "", price]
      );

      console.log("✅ Service added:", name);

      // 2️⃣.2 Automatically create a pending invoice item
      if (patient_id) {
        console.log("🧾 Auto-generating pending invoice for patient:", patient_id);

        // Find or create a pending invoice
        const existing = await client.execute(
          `SELECT invoice_id FROM invoices 
           WHERE patient_id = ? AND status = 'pending' 
           ORDER BY created_at DESC LIMIT 1`,
          [patient_id]
        );

        let invoice_id;
        if (existing.rows.length > 0) {
          invoice_id = existing.rows[0].invoice_id;
        } else {
          invoice_id = randomUUID();
          await client.execute(
            `INSERT INTO invoices (invoice_id, patient_id, clinic_id, total, status)
             VALUES (?, ?, ?, 0, 'pending')`,
            [invoice_id, patient_id, clinic_id]
          );
        }

        // Add invoice item
        const item_id = randomUUID();
        await client.execute(
          `INSERT INTO invoice_items (item_id, invoice_id, type, ref_id, description, price, quantity)
           VALUES (?, ?, 'service', ?, ?, ?, 1)`,
          [item_id, invoice_id, service_id, name, price]
        );

        // Update invoice total
        await client.execute(
          `UPDATE invoices
           SET total = (
             SELECT COALESCE(SUM(price * quantity), 0)
             FROM invoice_items WHERE invoice_id = ?
           )
           WHERE invoice_id = ?`,
          [invoice_id, invoice_id]
        );

        console.log("💰 Service added to invoice:", invoice_id);

        return res.status(201).json({
          message: "Service created and pending invoice updated",
          service_id,
          invoice_id,
        });
      }

      // If no patient provided → just return the service
      return res.status(201).json({
        message: "Service created (no invoice linked)",
        service_id,
      });
    }

    // =====================================
    // 3️⃣ METHOD NOT ALLOWED
    // =====================================
    res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error("❌ API Error (services):", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
