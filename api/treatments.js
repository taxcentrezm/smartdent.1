import { client } from "../db.js";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  try {
    switch (req.method) {
      // =====================================================
      // 1️⃣ GET ALL TREATMENTS
      // =====================================================
      case "GET": {
        const result = await client.execute("SELECT * FROM treatments;");
        return res.status(200).json(result.rows);
      }

      // =====================================================
      // 2️⃣ CREATE NEW TREATMENT + AUTO-INVOICE
      // =====================================================
      case "POST": {
        const { clinic_id = 1, name, service_id, price, patient_id } = req.body;

        if (!name || !service_id || !price) {
          return res
            .status(400)
            .json({ error: "name, service_id, and price are required." });
        }

        // 2️⃣.1 Add treatment record
        const treatment_id = randomUUID();
        await client.execute(
          "INSERT INTO treatments (treatment_id, name, service_id, price) VALUES (?, ?, ?, ?);",
          [treatment_id, name, service_id, price]
        );

        console.log("✅ Treatment created:", name);

        // 2️⃣.2 If a patient is linked → auto-invoice
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
             VALUES (?, ?, 'treatment', ?, ?, ?, 1)`,
            [item_id, invoice_id, treatment_id, name, price]
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

          console.log("💰 Treatment added to invoice:", invoice_id);

          return res.status(201).json({
            message: "Treatment created and pending invoice updated",
            treatment_id,
            invoice_id,
          });
        }

        // 2️⃣.3 If no patient → just confirm creation
        return res.status(201).json({
          message: "Treatment created (no invoice linked)",
          treatment_id,
        });
      }

      // =====================================================
      // 3️⃣ INVALID METHOD
      // =====================================================
      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ API Error (treatments):", err.message);
    res.status(500).json({ error: err.message });
  }
}
