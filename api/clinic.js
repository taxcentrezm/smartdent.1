import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    const { method, query = {}, body = {} } = req;
    const isChat = query.chat === "true";

    // =======================================
    // CHAT ASSISTANT MODE
    // =======================================
    if (isChat && method === "GET") {
      const { message = "" } = query;
      const lower = message.toLowerCase();

      // 🔍 Handle basic clinic queries
      if (lower.includes("how many") || lower.includes("count")) {
        const result = await client.execute("SELECT COUNT(*) AS total FROM clinic;");
        const total = result.rows[0]?.total || 0;
        return res.status(200).json({
          reply: `We currently have ${total} clinic${total === 1 ? "" : "s"} registered.`,
        });
      }

      if (lower.includes("show") || lower.includes("list")) {
        const result = await client.execute("SELECT name, address, phone FROM clinic;");
        if (!result.rows.length) {
          return res.status(200).json({ reply: "No clinics found in the system." });
        }

        const list = result.rows.map((c, i) => `${i + 1}. ${c.name} (${c.phone})`).join("\n");
        return res.status(200).json({
          reply: `Here are the clinics:\n${list}`,
        });
      }

      // Default fallback
      return res.status(200).json({
        reply: "I'm here to help with clinic info. Try asking 'How many clinics do we have?'",
      });
    }

    // =======================================
    // STANDARD CLINIC API
    // =======================================
    switch (method) {
      case "GET": {
        const result = await client.execute("SELECT * FROM clinic;");
        return res.status(200).json(result.rows);
      }

      case "POST": {
        const { name, address, phone, email } = body;
        if (!name || !phone) {
          return res.status(400).json({ error: "name and phone are required." });
        }

        await client.execute(
          "INSERT INTO clinic (name, address, phone, email) VALUES (?, ?, ?, ?);",
          [name.trim(), address?.trim() || null, phone.trim(), email?.trim() || null]
        );

        return res.status(201).json({ message: "Clinic created successfully." });
      }

      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).json({ error: `Method ${method} not allowed.` });
    }
  } catch (err) {
    console.error("❌ API Error (clinic):", err.message);
    return res.status(500).json({ error: err.message });
  }
}
