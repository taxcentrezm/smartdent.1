// api/hr.js
import { createClient } from "@libsql/client";

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

    
   // POST: Approve leave
if (req.method === "POST") {
  const staffId = req.body?.staff_id || req.query?.staff_id;
  if (!staffId) return res.status(400).json({ error: "Missing staff_id" });

  const result = await client.execute(
    `UPDATE staff
     SET leave_days = COALESCE(leave_days,0)+1
     WHERE staff_id = ?`,
    [staffId]
  );

  const updatedStaffRes = await client.execute(
    `SELECT staff_id, leave_days FROM staff WHERE staff_id = ?`,
    [staffId]
  );

  const updatedStaff = updatedStaffRes.rows?.[0] ?? {};

  return res.status(200).json({
    message: "Leave approved",
    staff_id: staffId,
    leave_days: updatedStaff.leave_days ?? 0,
    updated: result.rowsAffected || 0
  });
}


    // =====================
    // GET: Fetch staff + payroll
    // =====================
    if (req.method === "GET") {
      console.log("📊 HR API: Fetching staff and payroll data...");

      // --- Fetch staff ---
      let staff = [];
      try {
        const staffRes = await client.execute(`
          SELECT staff_id, name, role, department, salary, photo, leave_days
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

      // --- Combine staff + payroll ---
      const staffWithPayroll = staff.map((emp) => {
        const empPayroll = payroll.filter((p) => p.staff_id === emp.staff_id);
        const months = empPayroll.map((p) => p.month ?? "Unknown");
        const nets = empPayroll.map((p) => p.net ?? 0);

        return {
          staff_id: emp.staff_id,
          name: emp.name,
          role: emp.role,
          department: emp.department,
          salary: Number(emp.salary) || 0,
          leave_days: emp.leave_days ?? 0,
          photo: emp.photo || "assets/images/default-avatar.png",
          months,
          nets,
          payroll: empPayroll,
        };
      });

      return res.status(200).json({
        staff: staffWithPayroll,
        totalStaff: staff.length,
        totalPayrollRecords: payroll.length,
      });
    }

    // =====================
    // Method not allowed
    // =====================
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("❌ HR API failed:", error);
    return res.status(500).json({
      error: "HR API failed",
      details: error.message,
      stack: error.stack,
    });
  }
}
