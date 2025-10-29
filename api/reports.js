// api/reports.js
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || process.env.chomadentistry_TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN || process.env.chomadentistry_TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  try {
    console.log("📊 Reports API: Fetching analytics...");

    // Helper to safely extract single numeric values
    const extractValue = (result, columnName, defaultValue = 0) => {
      if (!result?.rows || result.rows.length === 0) {
        console.warn(`⚠️ No rows returned for column "${columnName}"`);
        return defaultValue;
      }
      if (!(columnName in result.rows[0])) {
        console.warn(`⚠️ Column "${columnName}" missing in result`);
        return defaultValue;
      }
      return result.rows[0][columnName] ?? defaultValue;
    };

    // === 1. Total Patients ===
    const patients = await client.execute("SELECT COUNT(*) AS total FROM patients;");
    const totalPatients = extractValue(patients, "total");

    // === 2. Appointments Today ===
    const todayAppointments = await client.execute(`
      SELECT COUNT(*) AS total
      FROM appointments
      WHERE DATE(appointment_date) = DATE('now', 'localtime');
    `);
    const todayCount = extractValue(todayAppointments, "total");

    // === 3. Total Revenue (YTD) ===
    const revenue = await client.execute(`
      SELECT SUM(cost) AS total
      FROM treatments
      WHERE strftime('%Y', treatment_date) = strftime('%Y', 'now');
    `);
    const totalRevenue = extractValue(revenue, "total");

    // === 4. Low Stock Items ===
    const lowStock = await client.execute(`
      SELECT COUNT(*) AS total
      FROM stock
      WHERE quantity <= 5;
    `);
    const lowStockCount = extractValue(lowStock, "total");

    // === 5. Service Distribution (Pie Chart) ===
    const serviceDistribution = await client.execute(`
      SELECT s.name AS service, COUNT(t.treatment_id) AS total
      FROM treatments t
      JOIN services s ON t.service_id = s.service_id
      GROUP BY s.name;
    `);
    console.log("Service distribution raw:", serviceDistribution.rows);
    const serviceLabels = serviceDistribution.rows.map(r => r.service);
    const serviceValues = serviceDistribution.rows.map(r => r.total);

    // === 6. Monthly Patient Growth (Bar Chart) ===
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

    // === 7. Monthly Revenue Trend (Line Chart) ===
    const revenueTrendRaw = await client.execute(`
      SELECT strftime('%m', treatment_date) AS month, SUM(cost) AS total
      FROM treatments
      WHERE strftime('%Y', treatment_date) = strftime('%Y', 'now')
      GROUP BY month;
    `);

    // Prepare arrays for all months
    const revenueMonths = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const revenueValues = Array(12).fill(0);
    revenueTrendRaw.rows.forEach(r => {
      const monthIndex = parseInt(r.month, 10) - 1;
      revenueValues[monthIndex] = r.total ?? 0;
    });

    // === 8. Response ===
    return res.status(200).json({
      totalPatients,
      todayAppointments: todayCount,
      revenueYTD: totalRevenue,
      lowStock: lowStockCount,
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
