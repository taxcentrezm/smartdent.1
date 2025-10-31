import { client } from "../db.js";

export default async function handler(req, res) {
  console.log("📥 Incoming request to /api/users");
  console.log("🔍 Method:", req.method, " Query:", req.query);

  try {
    switch (req.method) {
      // ===================================================
      // 1️⃣ GET - Fetch all users or filter by role
      // ===================================================
      case "GET": {
        const { role } = req.query;

        let query;
        let params = [];

        if (role === "Dentist") {
          // Return only dentists and junior dentists
          query = `
            SELECT user_id, full_name, role
            FROM users
            WHERE role IN ('Dentist', 'junior_dentist');
          `;
        } else {
          // Return all users
          query = `SELECT user_id, full_name, role FROM users;`;
        }

        const result = await client.execute(query, params);
        console.log(`✅ ${result.rows.length} users fetched`);

        res.status(200).json({
          message: "Users fetched successfully",
          data: result.rows,
        });
        break;
      }

      // ===================================================
      // 2️⃣ POST - Create a new user
      // ===================================================
      case "POST": {
        const { full_name, email, password, role, clinic_id } = req.body;

        if (!full_name || !email || !password || !role || !clinic_id) {
          return res
            .status(400)
            .json({ error: "full_name, email, password, role, clinic_id required." });
        }

        await client.execute(
          `INSERT INTO users (full_name, email, password, role, clinic_id)
           VALUES (?, ?, ?, ?, ?);`,
          [full_name, email, password, role, clinic_id]
        );

        res.status(201).json({ message: "User created successfully" });
        break;
      }

      // ===================================================
      // ❌ Unsupported Methods
      // ===================================================
      default:
        res.setHeader("Allow", ["GET", "POST"]);
        res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ API Error (/api/users):", err.message);
    res.status(500).json({ error: err.message });
  }
}
