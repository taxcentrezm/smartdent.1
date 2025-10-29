// api/reports.js
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || process.env.chomadentistry_TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN || process.env.chomadentistry_TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  try {
    console.log("📊 Reports API: Fetching analytics...");

    // Helper to extract safe values
    const extractValue = (result, key, fallback = 0) =>
      result?.rows?.[0]?.[key] ?? fallback;

    // === 1️⃣ Total Patients ===
    const patients = await client.execute("SELECT COUNT(*) AS total FROM patients;");
    const totalPatients = extractValue(patients, "total");

    // === 2️⃣ Appointments (today & pending) ===
    const todayAppointments = await client.execute(`
      SELECT COUNT(*) AS total
      FROM appointments
      WHERE DATE(appointment_date) = DATE('now', 'localtime');
    `);
    const todayCount = extractValue(todayAppointments, "total");

    const pendingAppointments = await client.execute(`
      SELECT COUNT(*) AS total
      FROM appointments
      WHERE status = 'pending';
    `);
    const pendingCount = extractValue(pendingAppointments, "total");

    // === 3️⃣ Revenue (YTD & last year comparison) ===
    const revenueYTD = await client.execute(`
      SELECT SUM(cost) AS total
      FROM treatments
      WHERE strftime('%Y', treatment_date) = strftime('%Y', 'now');
    `);
    const totalRevenue = extractValue(revenueYTD, "total");

    const lastYearRevenue = await client.execute(`
      SELECT SUM(cost) AS total
      FROM treatments
      WHERE strftime('%Y', treatment_date) = strftime('%Y', 'now', '-1 year');
    `);
    const lastRevenue = extractValue(lastYearRevenue, "total");

    const revenueChange = lastRevenue
      ? (((totalRevenue - lastRevenue) / lastRevenue) * 100).toFixed(1)
      : 0;

    // === 4️⃣ Low Stock ===
    const lowStock = await client.execute(`
      SELECT COUNT(*) AS total
      FROM stock
      WHERE quantity <= 5;
    `);
    const lowStockCount = extractValue(lowStock, "total");

    // === 5️⃣ Service Distribution (Pie) ===
    const serviceDistribution = await client.execute(`
      SELECT s.name AS service, COUNT(t.treatment_id) AS total
      FROM treatments t
      JOIN services s ON t.service_id = s.service_id
      GROUP BY s.name;
    `);
    console.log("Service distribution raw:", serviceDistribution.rows);
    const serviceLabels = serviceDistribution.rows.map(r => r.service);
    const serviceValues = serviceDistribution.rows.map(r => r.total);

    // === 6️⃣ Monthly Patient Growth ===
    const patientGrowth = await client.execute(`
      SELECT strftime('%m', created_at) AS month, COUNT(*) AS total
      FROM patients
      WHERE strftime('%Y', created_at) = strftime('%Y', 'now')
      GROUP BY month
      ORDER BY month;
    `);
    console.log("Patient growth raw:", patientGrowth.rows);
    const patientMonths = patientGrowth.rows.map(r => r.month);
    const patientValues = patientGrowth.rows.map(r => r.total);

    // Calculate patient % growth (current vs previous month)
    let patientGrowthPercent = 0;
    if (patientValues.length >= 2) {
      const last = patientValues[patientValues.length - 1];
      const prev = patientValues[patientValues.length - 2];
      patientGrowthPercent = prev ? (((last - prev) / prev) * 100).toFixed(1) : 0;
    }

    // === 7️⃣ Revenue Trend (Line) ===
    const revenueTrendRaw = await client.execute(`
      SELECT strftime('%m', treatment_date) AS month, SUM(cost) AS total
      FROM treatments
      WHERE strftime('%Y', treatment_date) = strftime('%Y', 'now')
      GROUP BY month;
    `);
    const revenueMonths = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const revenueValues = Array(12).fill(0);
    revenueTrendRaw.rows.forEach(r => {
      const idx = parseInt(r.month, 10) - 1;
      revenueValues[idx] = r.total ?? 0;
    });

    // === ✅ Response ===
    return res.status(200).json({
      totalPatients,
      todayAppointments: todayCount,
      pendingAppointments: pendingCount,
      revenueYTD: totalRevenue,
      revenueChange,
      lowStock: lowStockCount,
      patientGrowth: patientGrowthPercent,
      serviceLabels,
      serviceValues,
      patientMonths,
      patientValues,
      revenueMonths,
      revenueValues
    });

  } catch (error) {
    console.error("❌ Reports API failed:", error);
    return res.status(500).json({
      error: "Reports API failed",
      details: error.message,
      stack: error.stack,
    });
  }
}
