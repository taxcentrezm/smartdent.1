// api/hr/approve-leave.js
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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { staff_id, action } = req.query; // e.g. ?staff_id=u4&action=add or remove

  if (!staff_id) {
    return res.status(400).json({ error: "Missing staff_id parameter" });
  }

  try {
    // === 1️⃣ Fetch current leave_days ===
    const result = await client.execute({
      sql: `SELECT leave_days FROM staff WHERE staff_id = ?;`,
      args: [staff_id],
    });

    if (!result.rows?.length) {
      return res.status(404).json({ error: "Staff not found" });
    }

    let current = Number(result.rows[0].leave_days ?? 0);
    let updated =
      action === "remove"
        ? Math.max(current - 1, 0)
        : current + 1; // default adds one

    // === 2️⃣ Update leave_days ===
    await client.execute({
      sql: `UPDATE staff SET leave_days = ? WHERE staff_id = ?;`,
      args: [updated, staff_id],
    });

    console.log(`✅ Leave updated for ${staff_id}: ${current} → ${updated}`);

    return res.status(200).json({
      success: true,
      staff_id,
      previous: current,
      updated,
    });
  } catch (error) {
    console.error("❌ Error updating leave:", error);
    return res.status(500).json({
      error: "Failed to update leave days",
      details: error.message,
    });
  }
}
