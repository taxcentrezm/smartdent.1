import { client } from "../db.js";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  try {
    switch (req.method) {

      // =====================================================
      // 1️⃣ GET: Fetch All Stock + Offers (for dropdowns)
      // =====================================================
      case "GET": {
        try {
          const stockRes = await client.execute("SELECT * FROM stock;");
          const stock = stockRes.rows || [];

          const servicesRes = await client.execute(
            "SELECT service_offer_id, name, base_cost FROM service_offers;"
          );
          const service_offers = servicesRes.rows || [];

          const treatmentsRes = await client.execute(
            "SELECT treatment_offer_id, name, base_price, duration_minutes FROM treatment_offers;"
          );
          const treatment_offers = treatmentsRes.rows || [];

          return res.status(200).json({
            stock,
            service_offers,
            treatment_offers,
          });
        } catch (dbErr) {
          console.error("❌ GET /stock error:", dbErr);
          return res.status(500).json({
            error: "Failed to fetch stock or offers",
            details: dbErr.message,
          });
        }
      }

      // =====================================================
      // 2️⃣ POST: Add New Stock Item
      // =====================================================
      case "POST": {
        try {
          const { item, quantity, price } = req.body;
          if (!item || quantity == null || price == null) {
            return res.status(400).json({
              error: "item, quantity, and price are required.",
            });
          }

          await client.execute(
            "INSERT INTO stock (item, quantity, price) VALUES (?, ?, ?);",
            [item, quantity, price]
          );

          return res.status(201).json({ message: "Stock item created" });
        } catch (dbErr) {
          console.error("❌ POST /stock error:", dbErr);
          return res.status(500).json({
            error: "Failed to create stock item",
            details: dbErr.message,
          });
        }
      }

      // =====================================================
      // 3️⃣ PATCH: Deduct Stock (for treatment use)
      // =====================================================
      case "PATCH": {
        try {
          const { item_id, quantity_used, patient_id, clinic_id = 1 } = req.body;

          if (!item_id || !quantity_used) {
            return res.status(400).json({
              error: "item_id and quantity_used are required.",
            });
          }

          const stockRes = await client.execute(
            "SELECT * FROM stock WHERE item_id = ?",
            [item_id]
          );

          if (stockRes.rows.length === 0) {
            return res.status(404).json({ error: "Stock item not found." });
          }

          const stockItem = stockRes.rows[0];
          const currentQty = stockItem.quantity || 0;

          if (currentQty < quantity_used) {
            return res.status(400).json({
              error: `Not enough stock for ${stockItem.item}. Available: ${currentQty}`,
            });
          }

          await client.execute(
            "UPDATE stock SET quantity = quantity - ? WHERE item_id = ?",
            [quantity_used, item_id]
          );

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

            const itemLineId = randomUUID();
            await client.execute(
              `INSERT INTO invoice_items (item_id, invoice_id, type, ref_id, description, price, quantity)
               VALUES (?, ?, 'stock', ?, ?, ?, ?)`,
              [
                itemLineId,
                invoice_id,
                item_id,
                stockItem.item,
                stockItem.price,
                quantity_used,
              ]
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
          }

          return res.status(200).json({
            message: "Stock updated successfully",
            item: stockItem.item,
            deducted: quantity_used,
            remaining: currentQty - quantity_used,
            invoice_id,
          });
        } catch (dbErr) {
          console.error("❌ PATCH /stock error:", dbErr);
          return res.status(500).json({
            error: "Failed to deduct stock",
            details: dbErr.message,
          });
        }
      }

      // =====================================================
      // 4️⃣ INVALID METHOD
      // =====================================================
      default:
        res.setHeader("Allow", ["GET", "POST", "PATCH"]);
        return res
          .status(405)
          .json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ Unexpected stock API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
