// api/reports.js
import { client } from "../db.js";  // ✅ fixed import path

export default async function handler(req, res) {
  try {
    const [
      patients,
      appointmentsToday,
      revenueYTD,
      lowStock,
      serviceDistribution,
      patientGrowth
    ] = await Promise.all([
      client.execute("SELECT COUNT(*) AS total FROM patients;"),

      client.execute(
        "SELECT COUNT(*) AS total FROM appointments WHERE date = date('now');"
      ),

      client.execute(
        "SELECT SUM(amount) AS total FROM treatments WHERE strftime('%Y', date) = strftime('%Y', 'now');"
      ),

      client.execute("SELECT COUNT(*) AS total FROM stock WHERE quantity < 5;"),

      client.execute(`
        SELECT s.name AS service, COUNT(t.id) AS count
        FROM treatments t
        JOIN services s ON s.id = t.service_id
        GROUP BY s.name
        ORDER BY count DESC
        LIMIT 5;
      `),

      client.execute(`
        SELECT strftime('%m', created_at) AS month, COUNT(*) AS count
        FROM patients
        WHERE strftime('%Y', created_at) = strftime('%Y', 'now')
        GROUP BY month
        ORDER BY month ASC;
      `)
    ]);

    res.status(200).json({
      totalPatients: patients.rows[0]?.total || 0,
      todayAppointments: appointmentsToday.rows[0]?.total || 0,
      revenueYTD: revenueYTD.rows[0]?.total || 0,
      lowStockItems: lowStock.rows[0]?.total || 0,
      serviceDistribution: serviceDistribution.rows || [],
      patientGrowth: patientGrowth.rows || []
    });
  } catch (err) {
    console.error("❌ Reports API failed:", err);
    res.status(500).json({ error: err.message });
  }
}
