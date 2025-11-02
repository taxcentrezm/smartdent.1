// /api/stock.js
import { client } from "../db.js";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  try {
    const { method } = req;
    const { type, clinic_id = "clinic_001" } = req.query;
    const body = req.body || {};

    switch (method) {
      // =====================================================
      // 1️⃣ GET — Fetch Stock, Suppliers, Analytics, or Usage
      // =====================================================
      case "GET": {
        if (type === "stock") {
          const stockRes = await client.execute(
            "SELECT * FROM stock WHERE clinic_id = ?;",
            [clinic_id]
          );
          return res.status(200).json({ data: stockRes.rows || [] });
        }

        if (type === "analytics") {
          const totalItems = await client.execute(
            "SELECT COUNT(*) AS total_items FROM stock WHERE clinic_id = ?;",
            [clinic_id]
          );
          const totalQty = await client.execute(
            "SELECT SUM(quantity) AS total_quantity FROM stock WHERE clinic_id = ?;",
            [clinic_id]
          );
          const lowStock = await client.execute(
            "SELECT COUNT(*) AS low_stock FROM stock WHERE quantity <= reorder_level AND clinic_id = ?;",
            [clinic_id]
          );

          return res.status(200).json({
            total_items: totalItems.rows[0].total_items,
            total_quantity: totalQty.rows[0].total_quantity || 0,
            low_stock: lowStock.rows[0].low_stock,
          });
        }

        if (type === "suppliers") {
          const suppliers = await client.execute(
            `SELECT s.supplier_id, s.name AS supplier_name, si.item_name, si.price
             FROM suppliers s
             LEFT JOIN supplier_items si ON s.supplier_id = si.supplier_id;`
          );
          return res.status(200).json({ data: suppliers.rows || [] });
        }

        if (type === "usage") {
          const usage = await client.execute(
            `SELECT su.date_used, su.item_id, st.name AS item_name, su.quantity, su.used_by, su.related_to
             FROM stock_usage su
             JOIN stock st ON st.stock_id = su.item_id
             WHERE st.clinic_id = ?
             ORDER BY su.date_used DESC LIMIT 30;`,
            [clinic_id]
          );
          return res.status(200).json({ data: usage.rows || [] });
        }

        return res.status(400).json({ error: "Invalid type specified." });
      }

      // =====================================================
      // 2️⃣ POST — Add New Stock, Create Order, or Deduct Stock
      // =====================================================
      case "POST": {
        const { action } = body;

        // ---- Add new stock ----
        if (action === "add") {
          const { name, quantity, reorder_level = 10, auto_reorder = false } = body;
          if (!name || quantity == null) {
            return res.status(400).json({ error: "name and quantity required" });
          }

          const stock_id = randomUUID();
          await client.execute(
            `INSERT INTO stock (stock_id, clinic_id, name, quantity, reorder_level, auto_reorder)
             VALUES (?, ?, ?, ?, ?, ?);`,
            [stock_id, clinic_id, name, quantity, reorder_level, auto_reorder]
          );

          return res.status(201).json({ message: "Stock item added", stock_id });
        }

        // ---- Place supplier order ----
        if (action === "order") {
          const { supplier_id, item_name, quantity, price } = body;
          if (!supplier_id || !item_name || !quantity) {
            return res.status(400).json({ error: "Missing order details." });
          }

          const order_id = randomUUID();
          await client.execute(
            `INSERT INTO stock_orders (order_id, supplier_id, item_name, quantity, price, clinic_id)
             VALUES (?, ?, ?, ?, ?, ?);`,
            [order_id, supplier_id, item_name, quantity, price || 0, clinic_id]
          );

          return res.status(201).json({ message: "Order placed", order_id });
        }

        // ---- Deduct stock ----
        if (action === "deduct") {
          const { item_id, quantity_used, used_by = "system", related_to = "invoice" } = body;
          if (!item_id || !quantity_used) {
            return res.status(400).json({ error: "item_id and quantity_used are required." });
          }

          const stockRes = await client.execute("SELECT * FROM stock WHERE stock_id = ?;", [item_id]);
          if (stockRes.rows.length === 0)
            return res.status(404).json({ error: "Stock item not found." });

          const stockItem = stockRes.rows[0];
          const currentQty = stockItem.quantity || 0;

          if (currentQty < quantity_used)
            return res.status(400).json({ error: `Insufficient stock for ${stockItem.name}.` });

          await client.execute("UPDATE stock SET quantity = quantity - ? WHERE stock_id = ?;", [
            quantity_used,
            item_id,
          ]);

          await client.execute(
            `INSERT INTO stock_usage (usage_id, item_id, quantity, used_by, related_to)
             VALUES (?, ?, ?, ?, ?);`,
            [randomUUID(), item_id, quantity_used, used_by, related_to]
          );

          return res.status(200).json({
            message: "Stock deducted successfully",
            item: stockItem.name,
            remaining: currentQty - quantity_used,
          });
        }

        return res.status(400).json({ error: "Invalid action specified." });
      }

      // =====================================================
      // 3️⃣ Unsupported Method
      // =====================================================
      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (err) {
    console.error("❌ Stock API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
