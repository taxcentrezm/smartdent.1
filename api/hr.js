// api/hr.js
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || process.env.chomadentistry_TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN || process.env.chomadentistry_TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  try {
    // =======================
    // GET: Fetch staff & payroll
    // =======================
    if (req.method === "GET") {
      const staffRes = await client.execute(`
        SELECT staff_id, name, role, department, salary, photo, leave_days
        FROM staff
        ORDER BY name;
      `);

      // Optionally fetch payroll if you want detailed payroll info
      const payrollRes = await client.execute(`
        SELECT staff_id, month, net
        FROM payroll
        ORDER BY staff_id, month;
      `);

      const staff = (staffRes.rows ?? []).map(emp => {
        const empPayroll = (payrollRes.rows ?? []).filter(p => p.staff_id === emp.staff_id);
        return {
          ...emp,
          payroll: empPayroll
        };
      });

      return res.status(200).json({ staff, totalStaff: staff.length, totalPayrollRecords: payrollRes.rows?.length || 0 });
    }

    // =======================
    // POST: Approve leave
    // =======================
    if (req.method === "POST") {
      const { staff_id } = req.query;
      if (!staff_id) return res.status(400).json({ error: "Missing staff_id" });

      await client.execute(`
        UPDATE staff
        SET leave_days = COALESCE(leave_days, 0) + 1
        WHERE staff_id = ?
      `, [staff_id]);

      return res.status(200).json({ success: true, staff_id });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("❌ HR API error:", err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
