import { client } from "../db.js";

export default async function handler(req, res) {
  console.log("📥 Incoming request to /api/doctors");
  try {
    switch (req.method) {
      case "GET": {
        // Query dentists and junior dentists only
        const result = await client.execute(
          "SELECT staff_id AS user_id, full_name, role, email FROM staff WHERE role IN ('Dentist', 'Junior Dentist');"
        );

        console.log(`✅ ${result.rows.length} doctors fetched.`);
        res.status(200).json({
          message: "Doctors fetched successfully",
          data: result.rows,
        });
        break;
      }

      default:
        res.setHeader("Allow", ["GET"]);
        res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ API Error (doctors):", err.message);
    res.status(500).json({ error: err.message });
  }
}
