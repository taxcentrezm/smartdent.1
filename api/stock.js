import { client } from "../db.js";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const type = url.searchParams.get("type") || "stock";
    const clinic_id = url.searchParams.get("clinic_id") || 1;

    switch (req.method) {

      // =====================================================
      // 1️⃣ GET: Fetch All Stock, Analytics, or Suppliers
      // =====================================================
      case "GET": {
        try {
          // --- Fetch current stock list
          if (type === "stock") {
            const stockRes = await client.execute(
              "SELECT * FROM stock WHERE clinic_id = ? ORDER BY datetime(created_at) DESC;",
              [clinic_id]
            );
            const stock = stockRes.rows || [];
            console.log(`✅ Stock fetched: ${stock.length} items`);
            return res.status(200).json({ data: stock });
          }

          // --- Analytics summary for dashboard cards
          if (type === "analytics") {
            const totals = await client.execute(
              `SELECT COUNT(*) AS total_items, SUM(quantity) AS total_quantity 
                 FROM stock WHERE clinic_id = ?;`,
              [clinic_id]
            );

            const lowStock = await client.execute(
              `SELECT COUNT(*) AS low_stock 
                 FROM stock WHERE clinic_id = ? AND quantity <= reorder_level;`,
              [clinic_id]
            );

            return res.status(200).json({
              total_items: totals.rows[0].total_items || 0,
              total_quantity: totals.rows[0].total_quantity || 0,
              low_stock: lowStock.rows[0].low_stock || 0,
            });
          }

          // --- Mock supplier offers (for e-commerce ordering)
          if (type === "suppliers") {
            const suppliers = [
              { id: 1, name: "DentalCare Supplies", item: "Latex Gloves", price: 25 },
              { id: 2, name: "OrthoPlus", item: "Composite Resin", price: 40 },
              { id: 3, name: "MedServe", item: "Dental Masks", price: 15 },
              { id: 4, name: "SterilX", item: "Sterilization Pouches", price: 12 },
            ];
            return res.status(200).json({ data: suppliers });
          }

          return res.status(400).json({ error: "Invalid GET type" });
        } catch (err) {
          console.error("❌ GET /stock error:", err);
          return res.status(500).json({ error: err.message });
        }
      }

      // =====================================================
      // 2️⃣ POST: Add New Stock Item or Place Supplier Order
      // =====================================================
      case "POST": {
        try {
          // --- Add new stock entry (manual add)
          if (type === "stock") {
            const { name, quantity, reorder_level = 10, auto_reorder = "FALSE" } = req.body;
            if (!name) return res.status(400).json({ error: "name is required" });

            await client.execute(
              `INSERT INTO stock (stock_id, clinic_id, name, quantity, reorder_level, auto_reorder)
               VALUES (?, ?, ?, ?, ?, ?);`,
              [randomUUID(), clinic_id, name, quantity || 0, reorder_level, auto_reorder]
            );

            return res.status(201).json({ message: "✅ Stock item created" });
          }

          // --- Place supplier order (e-commerce)
          if (type === "order") {
            const { supplier_id, item, quantity, price } = req.body;
            if (!supplier_id || !item || !quantity)
              return res.status(400).json({ error: "Missing supplier_id, item, or quantity" });

            console.log(
              `📦 Order placed from clinic ${clinic_id}: ${quantity} × ${item} @ ${price} (Supplier ${supplier_id})`
            );

            // (Future) Save to supplier_orders table
            return res.status(201).json({ message: "🛒 Order placed successfully" });
          }

          return res.status(400).json({ error: "Invalid POST type" });
        } catch (err) {
          console.error("❌ POST /stock error:", err);
          return res.status(500).json({ error: err.message });
        }
      }

      // =====================================================
      // 3️⃣ PATCH: Deduct Stock (Treatment use)
      // =====================================================
      case "PATCH": {
        try {
          const { item_id, quantity_used, patient_id, clinic_id = 1 } = req.body;
          if (!item_id || !quantity_used)
            return res.status(400).json({ error: "item_id and quantity_used are required." });

          const stockRes = await client.execute("SELECT * FROM stock WHERE item_id = ?;", [item_id]);
          if (stockRes.rows.length === 0)
            return res.status(404).json({ error: "Stock item not found." });

          const stockItem = stockRes.rows[0];
          const currentQty = stockItem.quantity || 0;

          if (currentQty < quantity_used) {
            return res.status(400).json({
              error: `Not enough stock for ${stockItem.item}. Available: ${currentQty}`,
            });
          }

          await client.execute("UPDATE stock SET quantity = quantity - ? WHERE item_id = ?;", [
            quantity_used,
            item_id,
          ]);

          let invoice_id = null;

          if (patient_id) {
            const existing = await client.execute(
              `SELECT invoice_id FROM invoices 
                 WHERE patient_id = ? AND status = 'pending'
                 ORDER BY created_at DESC LIMIT 1;`,
              [patient_id]
            );

            if (existing.rows.length > 0) {
              invoice_id = existing.rows[0].invoice_id;
            } else {
              invoice_id = randomUUID();
              await client.execute(
                `INSERT INTO invoices (invoice_id, patient_id, clinic_id, total, status)
                 VALUES (?, ?, ?, 0, 'pending');`,
                [invoice_id, patient_id, clinic_id]
              );
            }

            const itemLineId = randomUUID();
            await client.execute(
              `INSERT INTO invoice_items (item_id, invoice_id, type, ref_id, description, price, quantity)
               VALUES (?, ?, 'stock', ?, ?, ?, ?);`,
              [
                itemLineId,
                invoice_id,
                item_id,
                stockItem.item,
                stockItem.price,
                quantity_used,
              ]
            );

            await client.execute(
              `UPDATE invoices
                 SET total = (
                   SELECT COALESCE(SUM(price * quantity), 0)
                   FROM invoice_items WHERE invoice_id = ?
                 )
                 WHERE invoice_id = ?;`,
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
        } catch (err) {
          console.error("❌ PATCH /stock error:", err);
          return res.status(500).json({ error: err.message });
        }
      }

      // =====================================================
      // 4️⃣ DELETE: Remove Stock Item
      // =====================================================
      case "DELETE": {
        try {
          const stock_id = url.searchParams.get("stock_id");
          if (!stock_id) return res.status(400).json({ error: "Missing stock_id" });
          await client.execute("DELETE FROM stock WHERE stock_id = ? AND clinic_id = ?;", [
            stock_id,
            clinic_id,
          ]);
          return res.status(200).json({ message: "🗑️ Stock item deleted" });
        } catch (err) {
          console.error("❌ DELETE /stock error:", err);
          return res.status(500).json({ error: err.message });
        }
      }

      // =====================================================
      // 5️⃣ INVALID METHOD
      // =====================================================
      default:
        res.setHeader("Allow", ["GET", "POST", "PATCH", "DELETE"]);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ Unexpected stock API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
