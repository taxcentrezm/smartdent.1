import { client } from "../db.js";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  console.log("📥 Incoming request to /api/treatments");
  console.log("🔍 Method:", req.method);

  try {
    switch (req.method) {
        
// =====================================================
// 1️⃣ GET: Fetch all treatment offers (for dropdowns)
// =====================================================
case "GET": {
  try {
    const result = await client.execute(`
      SELECT 
        t.treatment_offer_id AS treatment_id,
        t.name AS treatment_name,
        t.description,
        t.base_price,
        t.duration_minutes,
        s.name AS service_name
      FROM treatment_offers t
      LEFT JOIN service_offers s ON t.service_offer_id = s.service_offer_id
      ORDER BY s.name, t.name;
    `);

    console.log("✅ Treatment offers fetched:", result.rows.length);
    return res.status(200).json({
      message: "Treatment offers fetched successfully",
      data: result.rows,
    });
  } catch (err) {
    console.error("❌ Error fetching treatment offers:", err);
    return res.status(500).json({ error: "Failed to fetch treatment offers" });
  }
}

      // =====================================================
      // 2️⃣ POST: Add new treatment + auto-invoice + stock deduction
      // =====================================================
      case "POST": {
        const {
          name,
          service_id,
          price,
          patient_id,
          stock_item_id,
          quantity_used = 0,
          clinic_id = 1,
        } = req.body;

        if (!name || !service_id || price == null) {
          return res
            .status(400)
            .json({ error: "Missing required fields: name, service_id, price" });
        }

        // 2️⃣.1 Create treatment
        const treatment_id = randomUUID();
        await client.execute(
          `INSERT INTO treatments (treatment_id, clinic_id, name, service_id, price)
           VALUES (?, ?, ?, ?, ?)`,
          [treatment_id, clinic_id, name, service_id, price]
        );

        console.log("✅ Treatment created:", name);

        let invoice_id = null;

        // 2️⃣.2 Find or create pending invoice for patient
        if (patient_id) {
          const existing = await client.execute(
            `SELECT invoice_id FROM invoices
             WHERE patient_id = ? AND status = 'pending'
             ORDER BY date DESC LIMIT 1`,
            [patient_id]
          );

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

          // 2️⃣.3 Add treatment as an invoice item
          const item_id = randomUUID();
          await client.execute(
            `INSERT INTO invoice_items (item_id, invoice_id, type, ref_id, description, price, quantity)
             VALUES (?, ?, 'treatment', ?, ?, ?, 1)`,
            [item_id, invoice_id, treatment_id, name, price]
          );

          console.log("🧾 Treatment added to invoice:", invoice_id);
        }

        // 2️⃣.4 Deduct stock (if applicable)
        if (stock_item_id && quantity_used > 0) {
          const stockRes = await client.execute(
            `SELECT * FROM stock WHERE item_id = ?`,
            [stock_item_id]
          );

          if (stockRes.rows.length === 0) {
            console.warn(`⚠️ Stock item not found: ${stock_item_id}`);
          } else {
            const stockItem = stockRes.rows[0];
            const availableQty = stockItem.quantity || 0;

            if (availableQty < quantity_used) {
              console.warn(
                `⚠️ Not enough stock for ${stockItem.item} (have ${availableQty})`
              );
            } else {
              await client.execute(
                `UPDATE stock SET quantity = quantity - ? WHERE item_id = ?`,
                [quantity_used, stock_item_id]
              );

              console.log(
                `📦 Deducted ${quantity_used} of ${stockItem.item} from stock`
              );

              // Add stock usage to invoice (if invoice exists)
              if (invoice_id) {
                const stockLineId = randomUUID();
                const totalPrice = (stockItem.price || 0) * quantity_used;

                await client.execute(
                  `INSERT INTO invoice_items (item_id, invoice_id, type, ref_id, description, price, quantity)
                   VALUES (?, ?, 'stock', ?, ?, ?, ?)`,
                  [
                    stockLineId,
                    invoice_id,
                    stock_item_id,
                    stockItem.item,
                    stockItem.price || 0,
                    quantity_used,
                  ]
                );

                console.log("🧾 Stock usage added to invoice:", invoice_id);
              }
            }
          }
        }

        // 2️⃣.5 Update invoice total
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
          invoice_id,
        });
      }

      // =====================================================
      // 3️⃣ INVALID METHOD
      // =====================================================
      default: {
        res.setHeader("Allow", ["GET", "POST"]);
        return res
          .status(405)
          .json({ error: `Method ${req.method} not allowed` });
      }
    }
  } catch (err) {
    console.error("❌ API Error (treatments):", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
