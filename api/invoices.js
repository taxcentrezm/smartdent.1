// api/invoices.js
import { createClient } from "@libsql/client";
import { randomUUID } from "crypto";

const client = createClient({
  url:
    process.env.TURSO_DATABASE_URL ||
    process.env.chomadentistry_TURSO_DATABASE_URL,
  authToken:
    process.env.TURSO_AUTH_TOKEN ||
    process.env.chomadentistry_TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  try {
    // ===============================================
    // 1️⃣  CREATE OR UPDATE INVOICE
    // ===============================================
    if (req.method === "POST") {
      const { patient_id, clinic_id, type, ref_id, description, price, quantity = 1 } = req.body;

      if (!patient_id)
        return res.status(400).json({ error: "Missing patient_id" });

      // 1️⃣.1 Find or create a pending invoice for this patient
      let invoice_id;
      const existing = await client.execute(
        `SELECT invoice_id FROM invoices 
         WHERE patient_id = ? AND status = 'pending' 
         ORDER BY created_at DESC LIMIT 1`,
        [patient_id]
      );

      if (existing.rows.length > 0) {
        invoice_id = existing.rows[0].invoice_id;
      } else {
        invoice_id = randomUUID();
        await client.execute(
          `INSERT INTO invoices (invoice_id, patient_id, clinic_id, total, status)
           VALUES (?, ?, ?, 0, 'pending')`,
          [invoice_id, patient_id, clinic_id || null]
        );
      }

      // 1️⃣.2 Insert invoice item (service / treatment / stock)
      const item_id = randomUUID();
      const safePrice = Number(price) || 0;
      await client.execute(
        `INSERT INTO invoice_items (item_id, invoice_id, type, ref_id, description, price, quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item_id, invoice_id, type, ref_id, description, safePrice, quantity]
      );

      // 1️⃣.3 Update invoice total
      await client.execute(
        `UPDATE invoices
         SET total = (
           SELECT COALESCE(SUM(quantity * price), 0)
           FROM invoice_items WHERE invoice_id = ?
         )
         WHERE invoice_id = ?`,
        [invoice_id, invoice_id]
      );

      return res.status(200).json({
        message: "Invoice item added",
        invoice_id,
        item_id,
      });
    }

    // ===============================================
    // 2️⃣  GET INVOICES (with items)
    // ===============================================
    if (req.method === "GET") {
      const { patient_id } = req.query;
      let invoicesQuery = `
        SELECT invoice_id, patient_id, clinic_id, total, status, created_at
        FROM invoices
      `;
      const params = [];

      if (patient_id) {
        invoicesQuery += " WHERE patient_id = ? ORDER BY created_at DESC";
        params.push(patient_id);
      } else {
        invoicesQuery += " ORDER BY created_at DESC";
      }

      const invoicesRes = await client.execute(invoicesQuery, params);
      const invoices = invoicesRes.rows ?? [];

      // Get all items
      const itemsRes = await client.execute(`
        SELECT item_id, invoice_id, type, ref_id, description, quantity, price, (quantity * price) AS total
        FROM invoice_items
        ORDER BY created_at DESC
      `);

      const items = itemsRes.rows ?? [];

      // Attach items to invoices
      const fullInvoices = invoices.map((inv) => ({
        ...inv,
        items: items.filter((it) => it.invoice_id === inv.invoice_id),
      }));

      return res.status(200).json({ invoices: fullInvoices });
    }

    // ===============================================
    // 3️⃣  MARK INVOICE AS PAID
    // ===============================================
    if (req.method === "PUT") {
      const { invoice_id, status } = req.body;
      if (!invoice_id) return res.status(400).json({ error: "Missing invoice_id" });

      await client.execute(
        `UPDATE invoices SET status = ? WHERE invoice_id = ?`,
        [status || "paid", invoice_id]
      );

      return res.status(200).json({ message: "Invoice updated", invoice_id, status });
    }

    // ===============================================
    // 4️⃣  DELETE INVOICE (optional admin)
    // ===============================================
    if (req.method === "DELETE") {
      const { invoice_id } = req.query;
      if (!invoice_id)
        return res.status(400).json({ error: "Missing invoice_id" });

      await client.execute(`DELETE FROM invoice_items WHERE invoice_id = ?`, [
        invoice_id,
      ]);
      await client.execute(`DELETE FROM invoices WHERE invoice_id = ?`, [
        invoice_id,
      ]);

      return res.status(200).json({ message: "Invoice deleted", invoice_id });
    }

    // ===============================================
    // 5️⃣  METHOD NOT ALLOWED
    // ===============================================
    return res.status(405).json({ error: "Method not allowed" });

  } catch (error) {
    console.error("❌ Invoices API failed:", error);
    return res.status(500).json({
      error: "Invoices API failed",
      details: error.message,
      stack: error.stack,
    });
  }
}
