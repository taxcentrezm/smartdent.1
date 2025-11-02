// /api/stock.js
import { client } from "../db.js";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  try {
    const { method } = req;
    const { type } = req.query;
    const clinic_id = "clinic_001"; // hardcoded for now
    const body = req.body || {};

    switch (method) {
      // ================= GET =================
      case "GET": {
        console.log(`📥 GET request received: type=${type}`);

        if (type === "suppliers") {
          console.log("📊 Fetching suppliers...");
          const suppliersRes = await client.execute(`SELECT * FROM suppliers;`);
          console.log(`✅ Suppliers fetched: ${suppliersRes.rows.length} found`);
          return res.status(200).json({ data: suppliersRes.rows });
        }

        if (type === "stock") {
          const stockRes = await client.execute(
            `SELECT * FROM stock WHERE clinic_id = '${clinic_id}';`
          );
          return res.status(200).json({ data: stockRes.rows });
        }

        if (type === "usage") {
          const limit = Math.min(parseInt(req.query.limit) || 30, 100);
          const usageRes = await client.execute(
            `SELECT su.usage_id, su.stock_id, su.quantity_used, su.used_in_service, su.created_at,
                    st.name AS item_name
             FROM stock_usage su
             LEFT JOIN stock st ON st.stock_id = su.stock_id
             WHERE su.clinic_id = '${clinic_id}'
             ORDER BY datetime(su.created_at) DESC
             LIMIT ${limit};`
          );
          return res.status(200).json({ data: usageRes.rows });
        }

        if (type === "analytics") {
          const stockRes = await client.execute(
            `SELECT * FROM stock WHERE clinic_id = '${clinic_id}';`
          );
          const total_items = stockRes.rows.length;
          const total_quantity = stockRes.rows.reduce(
            (sum, i) => sum + (i.quantity || 0),
            0
          );
          const low_stock = stockRes.rows.filter(
            (i) => (i.quantity || 0) <= (i.reorder_level || 10)
          ).length;
          return res.status(200).json({
            total_items,
            total_quantity,
            low_stock,
          });
        }

        if (type === "catalog") {
          const catalogRes = await client.execute(`SELECT * FROM supplier_items;`);
          return res.status(200).json({ data: catalogRes.rows });
        }

        return res.status(400).json({ error: "Invalid type for GET" });
      }

      // ================= POST =================
      case "POST": {
        const { action } = body;
        console.log(`📤 POST action received: ${action}`);

        if (action === "add") {
          const { name, quantity, reorder_level = 10 } = body;
          if (!name || !quantity)
            return res.status(400).json({ error: "Missing stock details" });

          const stock_id = randomUUID();
          await client.execute(
            `INSERT INTO stock (stock_id, clinic_id, name, quantity, reorder_level, auto_reorder, created_at)
             VALUES ('${stock_id}', '${clinic_id}', '${name}', ${quantity}, ${reorder_level}, 'TRUE', datetime('now'));`
          );
          return res.status(201).json({ message: "Stock added", stock_id });
        }

        if (action === "deduct") {
          const { stock_id, quantity_used, used_in_service = "invoice" } = body;
          if (!stock_id || !quantity_used)
            return res.status(400).json({ error: "Missing usage details" });

          const stockRes = await client.execute(
            `SELECT * FROM stock WHERE stock_id = '${stock_id}';`
          );
          if (!stockRes.rows.length)
            return res.status(404).json({ error: "Stock item not found" });

          const stockItem = stockRes.rows[0];
          const remaining = (stockItem.quantity || 0) - quantity_used;
          if (remaining < 0)
            return res.status(400).json({ error: "Insufficient stock" });

          await client.execute(
            `UPDATE stock SET quantity = ${remaining} WHERE stock_id = '${stock_id}';`
          );
          await client.execute(
            `INSERT INTO stock_usage (usage_id, clinic_id, stock_id, quantity_used, used_in_service, created_at)
             VALUES ('${randomUUID()}', '${clinic_id}', '${stock_id}', ${quantity_used}, '${used_in_service}', datetime('now'));`
          );

          return res.status(200).json({ message: "Stock deducted", remaining });
        }

       // ------------------ ORDER NEW STOCK ------------------
if (action === "order") {
  console.log("[INFO] 📦 Processing new order...");

  const { clinic_id, supplier_id, item_name, quantity, price } = body;

  console.log("[DEBUG] Incoming order data:", body);

  // Validate required fields
  if (!clinic_id || !supplier_id || !item_name || !quantity || !price) {
    console.error("[ERROR] ❌ Missing order details", body);
    return new Response(JSON.stringify({ success: false, error: "Missing order details" }), { status: 400 });
  }

  try {
    // Insert order record
    await client.execute({
      sql: `INSERT INTO stock_orders (clinic_id, supplier_id, item_name, quantity, price, order_date)
            VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      args: [clinic_id, supplier_id, item_name, quantity, price]
    });

    console.log("[INFO] ✅ Order inserted successfully into stock_orders.");

    // Update supplier_items quantity
    await client.execute({
      sql: `UPDATE supplier_items 
            SET available_quantity = available_quantity - ? 
            WHERE supplier_id = ? AND item_name = ?`,
      args: [quantity, supplier_id, item_name]
    });

    console.log(`[INFO] 🧾 Supplier item '${item_name}' updated (-${quantity}).`);

    // Add to main stock
    await client.execute({
      sql: `INSERT INTO stock (clinic_id, item_name, quantity, unit_price, supplier_id, last_updated)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(item_name) DO UPDATE SET quantity = quantity + excluded.quantity, last_updated = datetime('now');`,
      args: [clinic_id, item_name, quantity, price, supplier_id]
    });

    console.log(`[INFO] 🏪 Stock updated for '${item_name}' (+${quantity}).`);

    return new Response(JSON.stringify({ success: true, message: "Order processed successfully." }), { status: 200 });
  } catch (error) {
    console.error("[ERROR] ❌ Stock API error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}


      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (err) {
    console.error("❌ Stock API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
