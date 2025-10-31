import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  const { staff_id } = req.query;

  if (!staff_id) {
    return res.status(400).json({ error: "Missing staff_id" });
  }

  try {
    console.log(`🟢 Approving leave for: ${staff_id}`);

    // Fetch current leave count
    const result = await db.execute({
      sql: "SELECT leave_days FROM staff WHERE staff_id = ?",
      args: [staff_id],
    });

    if (!result.rows.length) {
      return res.status(404).json({ error: "Staff not found" });
    }

    const current = result.rows[0].leave_days || 0;
    const updated = current + 1;

    await db.execute({
      sql: "UPDATE staff SET leave_days = ? WHERE staff_id = ?",
      args: [updated, staff_id],
    });

    res.status(200).json({ success: true, staff_id, new_leave_days: updated });
  } catch (err) {
    console.error("❌ HR Approve Leave API failed:", err);
    res.status(500).json({ error: "Server error" });
  }
}
