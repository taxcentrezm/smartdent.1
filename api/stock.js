// /api/stock.js
import { client } from "../db.js";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  const clinic_id = "clinic_001"; // Static for now; later can be dynamic
  const { method, query, body = {} } = req;
  const { type } = query;

  try {
    console.log(`📦 [Stock API] ${method} request received | type=${type || "N/A"} | action=${body.action || "N/A"}`);

    // ===================== GET =====================
    if (method === "GET") {
      switch (type) {
        // --- Fetch all stock items ---
        case "stock": {
          const stockRes = await client.execute(`SELECT * FROM stock WHERE clinic_id = '${clinic_id}';`);
          console.log(`✅ Retrieved ${stockRes.rows.length} stock items`);
          return res.status(200).json({ data: stockRes.rows });
        }

        // --- Fetch usage records ---
        case "usage": {
          const limit = Math.min(parseInt(req.query.limit) || 30, 100);
          const usageRes = await client.execute(`
            SELECT su.usage_id, su.stock_id, su.quantity_used, su.used_in_service, su.created_at,
                   st.name AS item_name
            FROM stock_usage su
            LEFT JOIN stock st ON st.stock_id = su.stock_id
            WHERE su.clinic_id = '${clinic_id}'
            ORDER BY datetime(su.created_at) DESC
            LIMIT ${limit};
          `);
          console.log(`✅ Retrieved ${usageRes.rows.length} usage records`);
          return res.status(200).json({ data: usageRes.rows });
        }

        // --- Fetch analytics summary ---
        case "analytics": {
          const stockRes = await client.execute(`SELECT * FROM stock WHERE clinic_id = '${clinic_id}';`);
          const total_items = stockRes.rows.length;
          const total_quantity = stockRes.rows.reduce((sum, i) => sum + (i.quantity || 0), 0);
          const low_stock = stockRes.rows.filter(i => (i.quantity || 0) <= (i.reorder_level || 10)).length;
          console.log(`📊 Analytics: ${total_items} items | ${total_quantity} total qty | ${low_stock} low`);
          return res.status(200).json({ total_items, total_quantity, low_stock });
        }

        // --- Fetch suppliers list ---
        case "suppliers": {
          const suppliersRes = await client.execute("SELECT * FROM suppliers;");
          console.log(`✅ Retrieved ${suppliersRes.rows.length} suppliers`);
          return res.status(200).json({ data: suppliersRes.rows });
        }

        // --- Fetch supplier catalog ---
        case "catalog": {
          const catalogRes = await client.execute("SELECT * FROM supplier_items;");
          console.log(`✅ Retrieved ${catalogRes.rows.length} catalog items`);
          return res.status(200).json({ data: catalogRes.rows });
        }

        default:
          console.warn("⚠️ Invalid GET type");
          return res.status(400).json({ error: "Invalid type for GET" });
      }
    }

    // ===================== POST =====================
    if (method === "POST") {
      const { action } = body;

      // --- Deduct stock usage ---
      if (action === "deduct") {
        const { stock_id, quantity_used, used_in_service = "invoice" } = body;
        if (!stock_id || !quantity_used)
          return res.status(400).json({ error: "Missing usage details" });

        const stockRes = await client.execute(`SELECT * FROM stock WHERE stock_id = '${stock_id}';`);
        if (!stockRes.rows.length)
          return res.status(404).json({ error: "Stock item not found" });

        const stockItem = stockRes.rows[0];
        const remaining = (stockItem.quantity || 0) - Number(quantity_used);

        if (remaining < 0)
          return res.status(400).json({ error: "Insufficient stock available" });

        await client.execute(`UPDATE stock SET quantity = ${remaining} WHERE stock_id = '${stock_id}';`);
        await client.execute(`
          INSERT INTO stock_usage (usage_id, clinic_id, stock_id, quantity_used, used_in_service, created_at)
          VALUES ('${randomUUID()}', '${clinic_id}', '${stock_id}', ${quantity_used}, '${used_in_service}', datetime('now'));
        `);

        console.log(`🧾 Deducted ${quantity_used} from ${stockItem.name} (${stock_id}) | Remaining: ${remaining}`);
        return res.status(200).json({ message: "Stock deducted", remaining });
      }

      // --- Place supplier order ---
      if (action === "order") {
        const { supplier_id, item, quantity, price } = body;
        if (!supplier_id || !item || !quantity || !price)
          return res.status(400).json({ error: "Missing order details" });

        const order_id = randomUUID();
        const total = Number(quantity) * Number(price);

        await client.execute(`
          INSERT INTO stock_orders (order_id, clinic_id, supplier_id, item, quantity, price, total, status, created_at)
          VALUES ('${order_id}', '${clinic_id}', '${supplier_id}', '${item}', ${quantity}, ${price}, ${total}, 'Pending', datetime('now'));
        `);

        console.log(`📦 Order placed: ${item} x${quantity} @ ${price} = ${total}`);
        return res.status(201).json({ message: "Order placed successfully", order_id });
      }

      // --- Add new stock item ---
      if (action === "add") {
        const { name, quantity, reorder_level = 10 } = body;
        if (!name || quantity === undefined)
          return res.status(400).json({ error: "Missing stock details" });

        const stock_id = randomUUID();

        await client.execute(`
          INSERT INTO stock (stock_id, clinic_id, name, quantity, reorder_level, auto_reorder, created_at)
          VALUES ('${stock_id}', '${clinic_id}', '${name}', ${quantity}, ${reorder_level}, 'TRUE', datetime('now'));
        `);

        console.log(`✅ Added new stock: ${name} (x${quantity})`);
        return res.status(201).json({ message: "Stock added successfully", stock_id });
      }

      console.warn("⚠️ Invalid POST action");
      return res.status(400).json({ error: "Invalid action for POST" });
    }

    // ===================== UNSUPPORTED METHOD =====================
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: `Method ${method} not allowed` });

  } catch (err) {
    console.error("❌ Stock API error:", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
}
