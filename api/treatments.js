import { client } from "../db.js";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  try {
    switch (req.method) {
      // =====================================================
      // 1️⃣ GET: Fetch All Treatments
      // =====================================================
      case "GET": {
        const result = await client.execute(`
          SELECT t.*, s.name AS service_name
          FROM treatments t
          LEFT JOIN services s ON t.service_id = s.service_id;
        `);
        return res.status(200).json(result.rows);
      }

      // =====================================================
      // 2️⃣ POST: Add New Treatment + Auto Stock Deduction + Invoice
      // =====================================================
      case "POST": {
        const {
          name,
          service_id,
          price,
          patient_id,
          stock_item_id,
          quantity_used = 0,
          clinic_id = 1
        } = req.body;

        if (!name || !service_id || !price) {
          return res.status(400).json({
            error: "name, service_id, and price are required."
          });
        }

        // 2️⃣.1 Create Treatment Record
        const treatment_id = randomUUID();
        await client.execute(
          `INSERT INTO treatments (treatment_id, name, service_id, price)
           VALUES (?, ?, ?, ?);`,
          [treatment_id, name, service_id, price]
        );

        console.log("✅ Treatment created:", name);

        // 2️⃣.2 Create or Attach to Pending Invoice
        let invoice_id = null;
        if (patient_id) {
          const existing = await client.execute(
            `SELECT invoice_id FROM invoices
             WHERE patient_id = ? AND status = 'pending'
             ORDER BY created_at DESC LIMIT 1`,
            [patient_id]
          );

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

          // 2️⃣.3 Add Treatment as Invoice Line
          const itemLineId = randomUUID();
          await client.execute(
            `INSERT INTO invoice_items (item_id, invoice_id, type, ref_id, description, price, quantity)
             VALUES (?, ?, 'treatment', ?, ?, ?, 1)`,
            [itemLineId, invoice_id, treatment_id, name, price]
          );

          console.log("🧾 Treatment added to invoice:", invoice_id);
        }

        // 2️⃣.4 Deduct Stock (if applicable)
        if (stock_item_id && quantity_used > 0) {
          const stockRes = await client.execute(
            "SELECT * FROM stock WHERE item_id = ?",
            [stock_item_id]
          );

          if (stockRes.rows.length === 0) {
            console.warn(`⚠️ Stock item not found for treatment: ${stock_item_id}`);
          } else {
            const stockItem = stockRes.rows[0];
            const currentQty = stockItem.quantity || 0;

            if (currentQty < quantity_used) {
              console.warn(`⚠️ Not enough stock for ${stockItem.item} (have ${currentQty})`);
            } else {
              await client.execute(
                "UPDATE stock SET quantity = quantity - ? WHERE item_id = ?",
                [quantity_used, stock_item_id]
              );
              console.log(`📦 Deducted ${quantity_used} of ${stockItem.item}`);

              // Add stock usage to invoice (if invoice exists)
              if (invoice_id) {
                const stockLineId = randomUUID();
                const totalPrice = stockItem.price * quantity_used;

                await client.execute(
                  `INSERT INTO invoice_items (item_id, invoice_id, type, ref_id, description, price, quantity)
                   VALUES (?, ?, 'stock', ?, ?, ?, ?)`,
                  [
                    stockLineId,
                    invoice_id,
                    stock_item_id,
                    stockItem.item,
                    stockItem.price,
                    quantity_used
                  ]
                );

                console.log("🧾 Stock usage added to invoice:", invoice_id);
              }
            }
          }
        }

        // 2️⃣.5 Recalculate Invoice Total
        if (invoice_id) {
          await client.execute(
            `UPDATE invoices
             SET total = (
               SELECT COALESCE(SUM(price * quantity), 0)
               FROM invoice_items WHERE invoice_id = ?
             )
             WHERE invoice_id = ?`,
            [invoice_id, invoice_id]
          );
        }

        return res.status(201).json({
          message: "Treatment created successfully",
          treatment_id,
          invoice_id
        });
      }

      // =====================================================
      // 3️⃣ INVALID METHOD
      // =====================================================
      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res
          .status(405)
          .json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ API Error (treatments):", err.message);
    return res.status(500).json({ error: err.message });
  }
}
