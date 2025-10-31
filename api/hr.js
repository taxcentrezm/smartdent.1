// api/hr.js
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || process.env.chomadentistry_TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN || process.env.chomadentistry_TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  try {
    // =====================
    // POST: Approve leave
    // =====================
    if (req.method === "POST" && req.query.staff_id) {
      const staffId = req.query.staff_id;

      const result = await client.execute(`
        UPDATE staff
        SET leave_days = COALESCE(leave_days, 0) + 1
        WHERE staff_id = ?
      `, [staffId]);

      return res.status(200).json({
        message: "Leave approved",
        staff_id: staffId,
        updated: result?.rowsAffected || 0
      });
    }

    // =====================
    // GET: Fetch staff + payroll
    // =====================
    if (req.method === "GET") {
      console.log("📊 HR API: Fetching staff and payroll data...");

      // Safe extractor
      const safeExtract = (result, key, fallback = null) =>
        result?.rows?.map(r => r[key] ?? fallback) ?? [];

      // --- Fetch staff ---
      let staff = [];
      try {
        const staffRes = await client.execute(`
          SELECT staff_id, name, role, department, salary, leave_days, photo
          FROM staff
          ORDER BY name;
        `);
        staff = staffRes.rows ?? [];
        console.log("✅ Staff fetched:", staff.length);
      } catch (err) {
        console.warn("⚠️ Failed to fetch staff:", err.message);
      }

      // --- Fetch payroll ---
      let payroll = [];
      try {
        const payrollRes = await client.execute(`
          SELECT staff_id, month, net
          FROM payroll
          ORDER BY staff_id, month;
        `);
        payroll = payrollRes.rows ?? [];
        console.log("✅ Payroll fetched:", payroll.length);
      } catch (err) {
        console.warn("⚠️ Failed to fetch payroll:", err.message);
      }

      // --- Aggregate payroll by staff ---
      const payrollByStaff = staff.map(emp => {
        const empPayroll = payroll.filter(p => p.staff_id === emp.staff_id);
        const months = empPayroll.map(p => p.month ?? "Unknown");
        const nets = empPayroll.map(p => p.net ?? 0);

        return {
          staff_id: emp.staff_id,
          name: emp.name,
          role: emp.role,
          department: emp.department,
          salary: emp.salary ?? 0,
          photo: emp.photo ?? "",
          leave: emp.leave_days ?? 0,
          months,
          nets,
          payroll: empPayroll
        };
      });

      return res.status(200).json({
        staff: payrollByStaff,
        totalStaff: staff.length,
        totalPayrollRecords: payroll.length
      });
    }

    // Method not allowed
    return res.status(405).json({ error: "Method not allowed" });

  } catch (error) {
    console.error("❌ HR API failed:", error);
    return res.status(500).json({
      error: "HR API failed",
      details: error.message,
      stack: error.stack
    });
  }
}
