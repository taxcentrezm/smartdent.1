import { client } from "../db.js";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  try {
    const { type, clinic_id } = req.query;

    // =====================================================
    // 1️⃣ GET Requests
    // =====================================================
    if (req.method === "GET") {
      switch (type) {

        // Fetch all stock for a clinic
        case "stock": {
          if (!clinic_id) return res.status(400).json({ error: "clinic_id is required" });

          const stockRes = await client.execute(
            "SELECT * FROM stock WHERE clinic_id = ? ORDER BY name ASC;",
            [clinic_id]
          );

          return res.status(200).json({ data: stockRes.rows || [] });
        }

        // Fetch analytics
        case "analytics": {
          if (!clinic_id) return res.status(400).json({ error: "clinic_id is required" });

          const totalItemsRes = await client.execute(
            "SELECT COUNT(*) AS total_items, SUM(quantity) AS total_quantity FROM stock WHERE clinic_id = ?;",
            [clinic_id]
          );
          const lowStockRes = await client.execute(
            "SELECT COUNT(*) AS low_stock FROM stock WHERE clinic_id = ? AND quantity < reorder_level;",
            [clinic_id]
          );

          return res.status(200).json({
            total_items: totalItemsRes.rows[0]?.total_items || 0,
            total_quantity: totalItemsRes.rows[0]?.total_quantity || 0,
            low_stock: lowStockRes.rows[0]?.low_stock || 0,
          });
        }

        // Fetch all suppliers
        case "suppliers": {
          const supplierRes = await client.execute("SELECT * FROM suppliers ORDER BY name ASC;");
          return res.status(200).json({ data: supplierRes.rows || [] });
        }

        default:
          return res.status(400).json({ error: "Invalid type parameter" });
      }
    }

    // =====================================================
    // 2️⃣ POST Requests
    // =====================================================
    if (req.method === "POST") {
      const { item, clinic_id, supplier_id, quantity, price } = req.body;

      if (!item || !clinic_id || !supplier_id || !quantity || !price) {
        return res.status(400).json({ error: "item, clinic_id, supplier_id, quantity, price are required" });
      }

      const order_id = randomUUID();
      const total = quantity * price;

      await client.execute(
        `INSERT INTO stock_orders 
          (order_id, clinic_id, supplier_id, item, quantity, price, total, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending');`,
        [order_id, clinic_id, supplier_id, item, quantity, price, total]
      );

      return res.status(201).json({ message: "Stock order placed", order_id });
    }

    // =====================================================
    // 3️⃣ PATCH Requests (Deduct Stock Usage)
    // =====================================================
    if (req.method === "PATCH") {
      const { stock_id, clinic_id, quantity_used, used_in_service } = req.body;

      if (!stock_id || !clinic_id || !quantity_used) {
        return res.status(400).json({ error: "stock_id, clinic_id, quantity_used are required" });
      }

      // Fetch current stock
      const stockRes = await client.execute(
        "SELECT * FROM stock WHERE stock_id = ? AND clinic_id = ?;",
        [stock_id, clinic_id]
      );

      if (!stockRes.rows.length) return res.status(404).json({ error: "Stock item not found" });

      const currentQty = stockRes.rows[0].quantity || 0;

      if (currentQty < quantity_used) {
        return res.status(400).json({ error: `Insufficient stock. Available: ${currentQty}` });
      }

      // Deduct stock
      await client.execute(
        "UPDATE stock SET quantity = quantity - ? WHERE stock_id = ? AND clinic_id = ?;",
        [quantity_used, stock_id, clinic_id]
      );

      // Log usage
      const usage_id = randomUUID();
      await client.execute(
        `INSERT INTO stock_usage (usage_id, clinic_id, stock_id, quantity_used, used_in_service)
         VALUES (?, ?, ?, ?, ?);`,
        [usage_id, clinic_id, stock_id, quantity_used, used_in_service || 'General Use']
      );

      return res.status(200).json({
        message: "Stock deducted and usage logged",
        stock_id,
        quantity_used,
        remaining: currentQty - quantity_used
      });
    }

    // =====================================================
    // 4️⃣ Method Not Allowed
    // =====================================================
    res.setHeader("Allow", ["GET", "POST", "PATCH"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });

  } catch (err) {
    console.error("❌ /api/stock error:", err);
    return res.status(500).json({ error: err.message });
  }
}
