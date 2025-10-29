// api/hr.js
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || process.env.CHOMADENTISTRY_TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN || process.env.CHOMADENTISTRY_TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  try {
    console.log("📊 HR API: Fetching staff and payroll data...");

    // Helper to safely extract a single value
    const extractValue = (result, key, fallback = 0) =>
      result?.rows?.[0]?.[key] ?? fallback;

    // === 1️⃣ Fetch all staff ===
    const staffResult = await client.execute(`
      SELECT 
        staff_id, name, role, salary, photo, department, leave_days
      FROM staff
      ORDER BY name
      LIMIT 5;
    `);

    const staff = await Promise.all(
      staffResult.rows.map(async (emp) => {
        // === 2️⃣ Fetch last 10 months of payroll for this staff ===
        const payrollResult = await client.execute(`
          SELECT strftime('%m', pay_date) AS month, net_salary
          FROM payroll
          WHERE staff_id = ?
          ORDER BY pay_date DESC
          LIMIT 10;
        `, [emp.staff_id]);

        // Map months to short names
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const payroll = payrollResult.rows
          .map(p => ({
            month: months[parseInt(p.month, 10) - 1],
            net: p.net_salary
          }))
          .reverse(); // oldest → newest

        return {
          id: emp.staff_id,
          name: emp.name,
          role: emp.role,
          salary: emp.salary,
          photo: emp.photo,
          department: emp.department,
          leave: emp.leave_days,
          payroll
        };
      })
    );

    // === 3️⃣ Summary metrics ===
    const totalPayroll = staff.reduce((sum, emp) => {
      const latest = emp.payroll?.slice(-1)[0];
      return sum + (latest?.net ?? 0);
    }, 0);

    const lastRun = staff[0]?.payroll?.slice(-1)[0]?.month || "—";

    // === 4️⃣ Response ===
    return res.status(200).json({
      staff,
      summary: {
        totalStaff: staff.length,
        totalPayroll,
        lastRun
      }
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
