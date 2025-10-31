// api/users.js
import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    const type = req.query?.type || "all";

    if (req.method === "GET") {
      let query = "";
      let params = [];

      if (type === "doctors") {
        // Return only Dentists and Junior Dentists from staff
        query = `
          SELECT staff_id AS id, name, role, department, photo
          FROM staff
          WHERE LOWER(role) IN ('dentist', 'junior dentist')
          ORDER BY name;
        `;
      } else {
        // Return all users
        query = `
          SELECT user_id AS id, full_name AS name, role, email, created_at
          FROM users
          ORDER BY name;
        `;
      }

      const result = await client.execute(query, params);
      return res.status(200).json({
        message: type === "doctors" ? "Doctors fetched successfully" : "Users fetched successfully",
        type,
        data: result.rows ?? []
      });
    }

    // Optional: POST logic for user creation
    if (req.method === "POST") {
      const { full_name, email, role } = req.body;
      if (!full_name || !email || !role)
        return res.status(400).json({ error: "Missing required fields" });

      await client.execute(
        `INSERT INTO users (full_name, email, role) VALUES (?, ?, ?);`,
        [full_name, email, role]
      );

      return res.status(201).json({ message: "User created successfully" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("❌ Users API failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
