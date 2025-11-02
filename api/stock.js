// /api/stock.js
import { client } from "../db.js";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  try {
    const { method } = req;
    const { type, clinic_id = "clinic_001" } = req.query;
    const body = req.body || {};

    console.log(`🟢 Stock API called — Method: ${method}, Type: ${type}, Clinic: ${clinic_id}`);

    switch (method) {
      // =====================================================
      // 1️⃣ GET — Fetch Stock, Suppliers, Analytics, Usage
      // =====================================================
      case "GET": {
        // -------- Stock --------
        if (type === "stock") {
          const stockRes = await client.execute(
            "SELECT * FROM stock WHERE clinic_id = ?;",
            [clinic_id]
          );
          console.log(`✅ Fetched ${stockRes.rows.length} stock items`);
          return res.status(200).json({ data: stockRes.rows });
        }

        // -------- Analytics --------
        if (type === "analytics") {
          const stockRes = await client.execute(
            "SELECT * FROM stock WHERE clinic_id = ?;",
            [clinic_id]
          );
          const total_items = stockRes.rows.length;
          const total_quantity = stockRes.rows.reduce((sum, i) => sum + (i.quantity || 0), 0);
          const low_stock = stockRes.rows.filter(i => (i.quantity || 0) <= (i.reorder_level || 10)).length;

          console.log(`📊 Analytics — Total Items: ${total_items}, Total Quantity: ${total_quantity}, Low Stock: ${low_stock}`);
          return res.status(200).json({ total_items, total_quantity, low_stock });
        }

        // -------- Suppliers --------
        if (type === "suppliers") {
          const suppliersRes = await client.execute(
            `SELECT s.supplier_id, s.name AS supplier_name, s.contact, si.item_name, si.price, si.sku, si.unit, si.moq
             FROM suppliers s
             LEFT JOIN supplier_items si ON s.supplier_id = si.supplier_id;`
          );
          console.log(`✅ Fetched ${suppliersRes.rows.length} supplier items`);
          return res.status(200).json({ data: suppliersRes.rows });
        }

        // -------- Usage --------
        if (type === "usage") {
          const limit = parseInt(req.query.limit) || 50;
          const usageRes = await client.execute(
            `SELECT su.*, st.name AS item_name
             FROM stock_usage su
             JOIN stock st ON st.stock_id = su.stock_id
             WHERE su.clinic_id = ?
             ORDER BY datetime(su.created_at) DESC
             LIMIT ?;`,
            [clinic_id, limit]
          );
          console.log(`📈 Fetched ${usageRes.rows.length} recent usage records`);
          return res.status(200).json({ data: usageRes.rows });
        }

        return res.status(400).json({ error: "Invalid type specified for GET" });
      }

      // =====================================================
      // 2️⃣ POST — Add Stock, Place Order, or Deduct
      // =====================================================
      case "POST": {
        const { action } = body;

        // ---- Add Stock ----
        if (action === "add") {
          const { name, quantity, reorder_level = 10, auto_reorder = false } = body;
          if (!name || quantity == null) return res.status(400).json({ error: "name and quantity are required" });

          const stock_id = randomUUID();
          await client.execute(
            `INSERT INTO stock (stock_id, clinic_id, name, quantity, reorder_level, auto_reorder)
             VALUES (?, ?, ?, ?, ?, ?);`,
            [stock_id, clinic_id, name.trim(), quantity, reorder_level, auto_reorder]
          );

          console.log(`✅ Stock added — ${name} (${quantity})`);
          return res.status(201).json({ message: "Stock item added", stock_id });
        }

        // ---- Place Order ----
        if (action === "order") {
          const { supplier_id, item_name, quantity, price } = body;
          if (!supplier_id || !item_name || !quantity) return res.status(400).json({ error: "Missing order details" });

          const order_id = randomUUID();
          await client.execute(
            `INSERT INTO stock_orders (order_id, supplier_id, item_name, quantity, price, clinic_id)
             VALUES (?, ?, ?, ?, ?, ?);`,
            [order_id, supplier_id, item_name, quantity, price || 0, clinic_id]
          );

          console.log(`🛒 Order placed — ${item_name} x${quantity} from supplier ${supplier_id}`);
          return res.status(201).json({ message: "Order placed", order_id });
        }

        // ---- Deduct Stock ----
        if (action === "deduct") {
          const { stock_id, quantity_used, used_by = "system", used_in_service = "invoice" } = body;
          if (!stock_id || !quantity_used) return res.status(400).json({ error: "stock_id and quantity_used are required" });

          const stockRes = await client.execute("SELECT * FROM stock WHERE stock_id = ?;", [stock_id]);
          if (!stockRes.rows.length) return res.status(404).json({ error: "Stock item not found" });

          const stockItem = stockRes.rows[0];
          const currentQty = stockItem.quantity || 0;
          if (currentQty < quantity_used) return res.status(400).json({ error: `Insufficient stock for ${stockItem.name}` });

          await client.execute("UPDATE stock SET quantity = quantity - ? WHERE stock_id = ?;", [quantity_used, stock_id]);
          await client.execute(
            `INSERT INTO stock_usage (usage_id, clinic_id, stock_id, quantity_used, used_in_service)
             VALUES (?, ?, ?, ?, ?);`,
            [randomUUID(), clinic_id, stock_id, quantity_used, used_in_service]
          );

          console.log(`➖ Deducted ${quantity_used} from ${stockItem.name}. Remaining: ${currentQty - quantity_used}`);
          return res.status(200).json({
            message: "Stock deducted successfully",
            item: stockItem.name,
            remaining: currentQty - quantity_used,
          });
        }

        return res.status(400).json({ error: "Invalid action specified for POST" });
      }

      // =====================================================
      // 3️⃣ PATCH — Deduct stock (alternate method)
      // =====================================================
      case "PATCH": {
        const { stock_id, quantity_used, used_by = "system", used_in_service = "invoice" } = body;
        if (!stock_id || !quantity_used) return res.status(400).json({ error: "stock_id and quantity_used are required" });

        const stockRes = await client.execute("SELECT * FROM stock WHERE stock_id = ?;", [stock_id]);
        if (!stockRes.rows.length) return res.status(404).json({ error: "Stock item not found" });

        const stockItem = stockRes.rows[0];
        const currentQty = stockItem.quantity || 0;
        if (currentQty < quantity_used) return res.status(400).json({ error: `Insufficient stock for ${stockItem.name}` });

        await client.execute("UPDATE stock SET quantity = quantity - ? WHERE stock_id = ?;", [quantity_used, stock_id]);
        await client.execute(
          `INSERT INTO stock_usage (usage_id, clinic_id, stock_id, quantity_used, used_in_service)
           VALUES (?, ?, ?, ?, ?);`,
          [randomUUID(), clinic_id, stock_id, quantity_used, used_in_service]
        );

        console.log(`➖ PATCH Deduct — ${quantity_used} from ${stockItem.name}. Remaining: ${currentQty - quantity_used}`);
        return res.status(200).json({
          message: "Stock deducted successfully",
          item: stockItem.name,
          remaining: currentQty - quantity_used,
        });
      }

      // =====================================================
      // Unsupported Method
      // =====================================================
      default:
        res.setHeader("Allow", ["GET", "POST", "PATCH"]);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (err) {
    console.error("❌ Stock API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
