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
  console.log("📊 HR API: Fetching staff and payroll data...");

  try {
    // === 1️⃣ Fetch staff ===
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

    // === 2️⃣ Fetch payroll ===
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

    // === 3️⃣ Combine staff + payroll ===
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
      };
    });

    // === 4️⃣ API Response ===
    return res.status(200).json({
      staff: staffWithPayroll,
      totalStaff: staff.length,
      totalPayrollRecords: payroll.length,
    });
  } catch (error) {
    console.error("❌ HR API failed:", error);
    return res.status(500).json({
      error: "HR API failed",
      details: error.message,
    });
  }
}
