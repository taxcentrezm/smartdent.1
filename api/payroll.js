// api/payroll.js
import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    switch (req.method) {
      case "GET": {
        const result = await client.execute("SELECT * FROM payroll;");
        res.status(200).json(result.rows);
        break;
      }
      case "POST": {
        const { employee_id, salary, bonus, deductions, pay_date } = req.body;

        if (!employee_id || !salary || !pay_date) {
          return res.status(400).json({ error: "employee_id, salary, and pay_date are required." });
        }

        await client.execute(
          "INSERT INTO payroll (employee_id, salary, bonus, deductions, pay_date) VALUES (?, ?, ?, ?, ?);",
          [employee_id, salary, bonus || 0, deductions || 0, pay_date]
        );

        res.status(201).json({ message: "Payroll record created" });
        break;
      }
      default:
        res.setHeader("Allow", ["GET", "POST"]);
        res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error("❌ API Error (payroll):", err);
    res.status(500).json({ error: err.message });
  }
}
