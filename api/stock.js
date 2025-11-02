import { client } from "../db.js";

// Helper: calculate analytics
function calculateAnalytics(stockRows) {
  const total_items = stockRows.length;
  const total_quantity = stockRows.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const low_stock = stockRows.filter(i => (i.quantity || 0) <= (i.reorder_level || 10)).length;
  return { total_items, total_quantity, low_stock };
}

export default async function handler(req, res) {
  try {
    const { type, clinic_id } = req.query;

    switch (req.method) {

      // ============================
      // GET requests
      // ============================
      case "GET": {
        if (type === "stock") {
          const rows = await client.execute("SELECT * FROM stock WHERE clinic_id = ?;", [clinic_id]);
          return res.status(200).json({ data: rows.rows });
        }

        if (type === "suppliers") {
          const rows = await client.execute("SELECT * FROM suppliers;");
          const suppliers = rows.rows.map(s => ({ ...s, supplies: JSON.parse(s.supplies || '[]') }));
          return res.status(200).json({ data: suppliers });
        }

        if (type === "usage") {
          const rows = await client.execute("SELECT * FROM stock_usage WHERE clinic_id = ? ORDER BY datetime(created_at) DESC;", [clinic_id]);
          return res.status(200).json({ data: rows.rows });
        }

        if (type === "analytics") {
          const stockRows = await client.execute("SELECT * FROM stock WHERE clinic_id = ?;", [clinic_id]);
          return res.status(200).json(calculateAnalytics(stockRows.rows));
        }

        return res.status(400).json({ error: "Unknown GET type" });
      }

      // ============================
      // POST requests
      // ============================
      case "POST": {
        const { action } = req.body;

        // Add new stock
        if (action === "add") {
          const { clinic_id, name, quantity, reorder_level } = req.body;
          if (!clinic_id || !name || quantity == null) {
            return res.status(400).json({ error: "clinic_id, name, quantity are required" });
          }

          const stock_id = `stk-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          await client.execute(
            "INSERT INTO stock (stock_id, clinic_id, name, quantity, reorder_level) VALUES (?, ?, ?, ?, ?);",
            [stock_id, clinic_id, name, quantity, reorder_level || 10]
          );

          return res.status(201).json({ message: "Stock added", stock_id });
        }

        // Deduct stock (record usage)
        if (action === "deduct") {
          const { stock_id, quantity_used, clinic_id, used_by, used_in_service } = req.body;
          if (!stock_id || quantity_used == null || !clinic_id) {
            return res.status(400).json({ error: "stock_id, quantity_used, clinic_id are required" });
          }

          // 1. Update stock quantity
          await client.execute(
            "UPDATE stock SET quantity = quantity - ? WHERE stock_id = ? AND clinic_id = ?;",
            [quantity_used, stock_id, clinic_id]
          );

          // 2. Record usage
          const usage_id = `use-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          await client.execute(
            `INSERT INTO stock_usage (usage_id, stock_id, clinic_id, quantity_used, used_by, used_in_service, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?);`,
            [usage_id, stock_id, clinic_id, quantity_used, used_by || null, used_in_service || null, new Date().toISOString()]
          );

          return res.status(201).json({ message: "Stock deducted and usage recorded", usage_id });
        }

        // Place order
        if (action === "order") {
          const { supplier_id, sku, item_name, clinic_id, quantity, unit, unit_price } = req.body;
          if (!supplier_id || !sku || !item_name || !clinic_id || !quantity) {
            return res.status(400).json({ error: "Missing required order fields" });
          }

          const order_id = `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          await client.execute(
            `INSERT INTO stock_orders (order_id, supplier_id, sku, item_name, clinic_id, quantity, unit, unit_price, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [order_id, supplier_id, sku, item_name, clinic_id, quantity, unit || '', unit_price || 0, new Date().toISOString()]
          );

          return res.status(201).json({ message: "Order placed", order_id });
        }

        return res.status(400).json({ error: "Unknown POST action" });
      }

      // ============================
      // PATCH requests
      // ============================
      case "PATCH": {
        return res.status(400).json({ error: "PATCH not implemented, use POST with action" });
      }

      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ Stock API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
