import { client } from "../db.js";
import { randomUUID } from "crypto";

// /api/services.js
export default async function handler(req, res) {
  console.log("📥 Incoming request to /api/services");
  console.log("🔍 Method:", req.method);

  try {
// ===================================================
// 1️⃣ GET - Fetch all service offers for dropdowns
// ===================================================
case "GET": {
  // Fetch all treatment offers from treatment_offers table
  const query = `
    SELECT 
      t.treatment_offer_id,
      t.service_offer_id,
      t.name AS treatment_name,
      t.description,
      t.base_price,
      t.duration_minutes,
      s.name AS service_name
    FROM treatment_offers t
    LEFT JOIN service_offers s ON t.service_offer_id = s.service_offer_id
    ORDER BY s.name, t.name;
  `;

  try {
    const result = await client.execute(query);

    console.log("✅ Treatment offers fetched:", result.rows.length);

    return res.status(200).json({
      message: "Treatment offers fetched successfully",
      data: result.rows.map(row => ({
        treatment_id: row.treatment_offer_id,
        service_id: row.service_offer_id,
        name: row.treatment_name,
        description: row.description,
        price: row.base_price,
        duration: row.duration_minutes,
        service_name: row.service_name || "Unassigned"
      }))
    });
  } catch (err) {
    console.error("❌ Error fetching treatment offers:", err);
    return res.status(500).json({ error: "Failed to fetch treatment offers" });
  }
}



    // ===================================================
    // 2️⃣ POST - Add new service + optional auto-invoice
    // ===================================================
    if (req.method === "POST") {
      const {
        clinic_id = 1,
        name,
        description = "",
        price,
        patient_id,
      } = req.body;

      if (!name || price == null) {
        return res
          .status(400)
          .json({ error: "Missing required fields: name or price" });
      }

      // 🧾 Create new service
      const service_id = randomUUID();
      await client.execute(
        `INSERT INTO services (service_id, clinic_id, name, description, price)
         VALUES (?, ?, ?, ?, ?)`,
        [service_id, clinic_id, name, description, price]
      );

      console.log("✅ New service added:", name);

      // ===================================================
      //  Auto-generate pending invoice if patient_id provided
      // ===================================================
      if (patient_id) {
        console.log("🧾 Auto-generating pending invoice for patient:", patient_id);

        // Check for existing pending invoice
        const existing = await client.execute(
          `SELECT invoice_id FROM invoices 
           WHERE patient_id = ? AND status = 'pending'
           ORDER BY date DESC LIMIT 1`,
          [patient_id]
        );

        let invoice_id;
        if (existing.rows.length > 0) {
          invoice_id = existing.rows[0].invoice_id;
        } else {
          invoice_id = randomUUID();
          const today = new Date().toISOString().split("T")[0];
          await client.execute(
            `INSERT INTO invoices (invoice_id, clinic_id, patient_id, full_name, total, status, date)
             VALUES (?, ?, ?, 
               (SELECT full_name FROM patients WHERE patient_id = ?),
               0, 'pending', ?)`,
            [invoice_id, clinic_id, patient_id, patient_id, today]
          );
        }

        // Add service as an invoice item
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
             FROM invoice_items
             WHERE invoice_id = ?
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

      // If no patient provided → service only
      return res.status(201).json({
        message: "Service created (no invoice linked)",
        service_id,
      });
    }

    // ===================================================
    // ❌ Unsupported method
    // ===================================================
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error("❌ API Error (services):", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
