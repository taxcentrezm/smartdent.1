import { client } from "../db.js"; // Turso / SQLite client

/**
 * Helper to log messages with timestamp
 */
function log(msg, type = "info") {
  const ts = new Date().toISOString();
  console[type === "error" ? "error" : "log"](`${ts} [${type.toUpperCase()}] ${msg}`);
}

/**
 * Generate unique ID
 */
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

/**
 * API handler for stock and inventory management
 */
export default async function handler(req, res) {
  try {
    log(`🟢 Stock API called — Method: ${req.method}, URL: ${req.url}`);

    const { type, clinic_id } = req.query;

    switch (req.method) {
      // ===============================
      // GET REQUESTS
      // ===============================
      case "GET":
        switch (type) {
          case "stock": {
            const query = "SELECT * FROM stock WHERE clinic_id = ? ORDER BY created_at DESC;";
            const result = await client.execute(query, [clinic_id]);
            log(`✅ Fetched ${result.rows.length} stock items`);
            return res.status(200).json({ data: result.rows });
          }

          case "usage": {
            const limit = parseInt(req.query.limit || "50");
            const query = `
              SELECT * FROM stock_usage
              WHERE clinic_id = ?
              ORDER BY datetime(created_at) DESC
              LIMIT ?;
            `;
            const result = await client.execute(query, [clinic_id, limit]);
            log(`✅ Fetched ${result.rows.length} usage records`);
            return res.status(200).json({ data: result.rows });
          }

          case "analytics": {
            const stockRes = await client.execute(
              "SELECT quantity, reorder_level FROM stock WHERE clinic_id = ?;",
              [clinic_id]
            );

            const totalItems = stockRes.rows.length;
            const totalQuantity = stockRes.rows.reduce((s, i) => s + (i.quantity || 0), 0);
            const lowStock = stockRes.rows.filter(i => (i.quantity || 0) <= (i.reorder_level || 10)).length;

            log(`📊 Analytics — Total Items: ${totalItems}, Total Quantity: ${totalQuantity}, Low Stock: ${lowStock}`);
            return res.status(200).json({ total_items: totalItems, total_quantity: totalQuantity, low_stock: lowStock });
          }

          case "suppliers": {
            const suppliersRes = await client.execute("SELECT * FROM suppliers ORDER BY created_at DESC;");
            const supplierItemsRes = await client.execute("SELECT * FROM supplier_items;");
            
            // Map items to suppliers
            const suppliers = suppliersRes.rows.map(sup => {
              return {
                ...sup,
                supplies: supplierItemsRes.rows.filter(si => si.supplier_id === sup.supplier_id)
              };
            });

            log(`✅ Fetched ${suppliers.length} suppliers with items`);
            return res.status(200).json({ data: suppliers });
          }

          default:
            return res.status(400).json({ error: "Unknown GET type" });
        }

      // ===============================
      // POST REQUESTS
      // ===============================
      case "POST":
        switch (type) {
          case "create": {
            const { name, quantity, reorder_level, clinic_id } = req.body;
            if (!name || quantity == null || !clinic_id) {
              return res.status(400).json({ error: "Missing required fields: name, quantity, clinic_id" });
            }

            const stock_id = generateId("s");
            const query = `
              INSERT INTO stock (stock_id, clinic_id, name, quantity, reorder_level, auto_reorder, created_at)
              VALUES (?, ?, ?, ?, ?, 'TRUE', datetime('now'));
            `;
            await client.execute(query, [stock_id, clinic_id, name, parseInt(quantity), parseInt(reorder_level || 10)]);
            log(`✅ Created stock item ${name} (${stock_id})`);
            return res.status(201).json({ message: "Stock created", stock_id });
          }

          case "order": {
            const { supplier_id, item_id, item_name, clinic_id, quantity, price } = req.body;
            if (!supplier_id || !item_id || !clinic_id || !quantity) {
              return res.status(400).json({ error: "Missing required order fields" });
            }

            const order_id = generateId("o");
            const total = parseFloat(price) * parseInt(quantity);
            const query = `
              INSERT INTO stock_orders (order_id, clinic_id, supplier_id, item, quantity, price, total, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', datetime('now'));
            `;
            await client.execute(query, [order_id, clinic_id, supplier_id, item_name, parseInt(quantity), parseFloat(price), total]);
            log(`✅ Created order ${order_id} for ${item_name}`);
            return res.status(201).json({ message: "Order placed", order_id });
          }

          default:
            return res.status(400).json({ error: "Unknown POST type" });
        }

      // ===============================
      // PATCH REQUESTS (deduct)
      // ===============================
      case "PATCH":
        if (type === "deduct") {
          const { stock_id, quantity_used, clinic_id, used_in_service } = req.body;
          if (!stock_id || quantity_used == null || !clinic_id || !used_in_service) {
            return res.status(400).json({ error: "Missing required fields for deduction" });
          }

          // Deduct stock
          const stockRes = await client.execute("SELECT quantity FROM stock WHERE stock_id = ? AND clinic_id = ?;", [stock_id, clinic_id]);
          const currentQty = stockRes.rows[0]?.quantity || 0;
          const newQty = Math.max(currentQty - parseInt(quantity_used), 0);

          await client.execute("UPDATE stock SET quantity = ? WHERE stock_id = ? AND clinic_id = ?;", [newQty, stock_id, clinic_id]);

          // Log usage
          const usage_id = generateId("u");
          await client.execute(
            `INSERT INTO stock_usage (usage_id, clinic_id, stock_id, quantity_used, used_in_service, created_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'));`,
            [usage_id, clinic_id, stock_id, parseInt(quantity_used), used_in_service]
          );

          log(`✅ Deducted ${quantity_used} from ${stock_id} for service "${used_in_service}"`);
          return res.status(200).json({ message: "Stock deducted", new_quantity: newQty, usage_id });
        }
        return res.status(400).json({ error: "Unknown PATCH type" });

      default:
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    log(`❌ Stock API error: ${err.message}`, "error");
    return res.status(500).json({ error: err.message });
  }
}
