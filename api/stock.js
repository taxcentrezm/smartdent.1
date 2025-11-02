import { client } from "../db.js";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  try {
    const url = req.url || "";
    const type = new URL(req.url, "http://dummy").searchParams.get("type");

    switch (req.method) {
      // =====================================================
      // 1️⃣ GET: Fetch Stock, Analytics, or Supplier Data
      // =====================================================
      case "GET": {
        if (type === "analytics") {
          const [stockRes, usageRes] = await Promise.all([
            client.execute("SELECT COUNT(*) AS total_items, SUM(quantity) AS total_quantity, SUM(CASE WHEN quantity <= reorder_level THEN 1 ELSE 0 END) AS low_stock FROM stock;"),
            client.execute("SELECT * FROM stock_usage ORDER BY datetime(created_at) DESC LIMIT 10;"),
          ]);

          const analytics = stockRes.rows[0];
          const usage = usageRes.rows;

          return res.status(200).json({
            analytics,
            recent_usage: usage,
          });
        }

        if (type === "suppliers") {
          const suppliersRes = await client.execute("SELECT * FROM suppliers;");
          const supplierStockRes = await client.execute("SELECT * FROM supplier_items;");
          const suppliers = suppliersRes.rows.map(s => ({
            ...s,
            supplies: supplierStockRes.rows.filter(i => i.supplier_id === s.supplier_id),
          }));

          return res.status(200).json({ data: suppliers });
        }

        // Default: fetch all stock
        const stockRes = await client.execute("SELECT * FROM stock ORDER BY datetime(created_at) DESC;");
        return res.status(200).json({ data: stockRes.rows });
      }

      // =====================================================
      // 2️⃣ POST: Add New Stock OR Place New Order
      // =====================================================
      case "POST": {
        const { action } = req.body;

        // ---- Add New Stock ----
        if (action === "add_stock") {
          const { clinic_id, name, quantity, reorder_level, auto_reorder } = req.body;
          if (!clinic_id || !name) {
            return res.status(400).json({ error: "clinic_id and name are required." });
          }

          const stock_id = randomUUID();
          await client.execute(
            `INSERT INTO stock (stock_id, clinic_id, name, quantity, reorder_level, auto_reorder)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [stock_id, clinic_id, name, quantity || 0, reorder_level || 10, auto_reorder || "FALSE"]
          );

          return res.status(201).json({ message: "New stock item added successfully." });
        }

        // ---- Place Order ----
        if (action === "place_order") {
          const { supplier_id, item_id, quantity, price } = req.body;
          if (!supplier_id || !item_id || !quantity) {
            return res.status(400).json({ error: "supplier_id, item_id, and quantity are required." });
          }

          const order_id = randomUUID();
          await client.execute(
            `INSERT INTO stock_orders (order_id, supplier_id, item_id, quantity, price, status, created_at)
             VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP);`,
            [order_id, supplier_id, item_id, quantity, price || 0]
          );

          return res.status(201).json({ message: "Stock order placed successfully." });
        }

        return res.status(400).json({ error: "Invalid action specified." });
      }

      // =====================================================
      // 3️⃣ PATCH: Deduct Stock Automatically (Treatment / Invoice / Service)
      // =====================================================
      case "PATCH": {
        const { item_id, quantity_used, context, patient_id, clinic_id = "clinic_001" } = req.body;

        if (!item_id || !quantity_used) {
          return res.status(400).json({ error: "item_id and quantity_used are required." });
        }

        // Fetch the item
        const stockRes = await client.execute("SELECT * FROM stock WHERE stock_id = ?", [item_id]);
        if (stockRes.rows.length === 0) {
          return res.status(404).json({ error: "Stock item not found." });
        }

        const stockItem = stockRes.rows[0];
        const remainingQty = stockItem.quantity - quantity_used;

        if (remainingQty < 0) {
          return res.status(400).json({ error: `Insufficient stock for ${stockItem.name}` });
        }

        // Deduct quantity
        await client.execute("UPDATE stock SET quantity = ? WHERE stock_id = ?", [remainingQty, item_id]);

        // Record usage log
        const usage_id = randomUUID();
        await client.execute(
          `INSERT INTO stock_usage (usage_id, stock_id, clinic_id, patient_id, quantity_used, context, created_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [usage_id, item_id, clinic_id, patient_id || null, quantity_used, context || "system"]
        );

        return res.status(200).json({
          message: "Stock updated successfully.",
          item: stockItem.name,
          deducted: quantity_used,
          remaining: remainingQty,
        });
      }

      // =====================================================
      // 4️⃣ INVALID METHOD
      // =====================================================
      default:
        res.setHeader("Allow", ["GET", "POST", "PATCH"]);
        return res.status(405).json({ error: `Method ${req.method} not allowed.` });
    }
  } catch (err) {
    console.error("❌ API Error (/stock.js):", err.message);
    return res.status(500).json({ error: err.message });
  }
}
