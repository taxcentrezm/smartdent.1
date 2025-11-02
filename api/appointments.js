import { client } from "../db.js"; // adjust path as needed
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  const { method } = req;
  const body = req.body || {};

  try {
    if (method === "GET") {
      const result = await client.execute("SELECT * FROM appointments ORDER BY date ASC, time ASC;");
      return res.status(200).json({ data: result.rows });
    }

    if (method === "POST") {
      const { patient, dentist, date, time } = body;
      if (!patient || !dentist || !date || !time) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const id = randomUUID();
      await client.execute(
        `INSERT INTO appointments (id, patient, dentist, date, time)
         VALUES (?, ?, ?, ?, ?);`,
        [id, patient, dentist, date, time]
      );

      return res.status(200).json({ message: "Appointment created", id });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: `Method ${method} not allowed` });
  } catch (err) {
    console.error("❌ Appointment API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
