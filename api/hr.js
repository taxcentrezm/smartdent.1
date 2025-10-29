// api/hr.js
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || process.env.chomadentistry_TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN || process.env.chomadentistry_TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  try {
    console.log("📊 HR API: Fetching staff and payroll data...");

    const extractValue = (result, key, fallback = 0) =>
      result?.rows?.[0]?.[key] ?? fallback;

    // === 1️⃣ Staff List ===
    const staffRaw = await client.execute(`
      SELECT staff_id, name, role, department, salary
      FROM staff
      ORDER BY name;
    `);
    const staff = staffRaw.rows;

    // === 2️⃣ Monthly Payroll per Staff ===
    const payrollRaw = await client.execute(`
      SELECT staff_id, month, SUM(net) AS total_net
      FROM payroll
      GROUP BY staff_id, month
      ORDER BY staff_id, month;
    `);

    // Transform payroll into a map by staff_id
    const payrollMap = {};
    payrollRaw.rows.forEach(r => {
      if (!payrollMap[r.staff_id]) payrollMap[r.staff_id] = {};
      payrollMap[r.staff_id][r.month] = r.total_net;
    });

    // === 3️⃣ Staff Payroll Summary ===
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const staffPayroll = staff.map(emp => {
      const empPayroll = payrollMap[emp.staff_id] || {};
      const monthlyNet = months.map(m => empPayroll[m] || 0);
      const totalNet = monthlyNet.reduce((a,b) => a+b, 0);
      return {
        staff_id: emp.staff_id,
        name: emp.name,
        role: emp.role,
        department: emp.department,
        salary: emp.salary,
        monthlyNet,
        totalNet
      };
    });

    // === 4️⃣ Response ===
    return res.status(200).json({
      staffPayroll,
      months
    });

  } catch (error) {
    console.error("❌ HR API failed:", error);
    return res.status(500).json({
      error: "HR API failed",
      details: error.message,
      stack: error.stack,
    });
  }
}
