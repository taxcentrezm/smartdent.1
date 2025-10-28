import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await client.execute("SELECT * FROM payroll;");
      res.status(200).json(result.rows);
    } else if (req.method === "POST") {
      const { staff_id, salary, month } = req.body;
      const query = "INSERT INTO payroll (staff_id, salary, month) VALUES (?, ?, ?);";
      await client.execute(query, [staff_id, salary, month]);
      res.status(201).json({ message: "Payroll entry added successfully" });
    } else {
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
