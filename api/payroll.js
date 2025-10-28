import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await client.execute("SELECT * FROM payroll;");
      res.status(200).json(result.rows);

    } else if (req.method === "POST") {
      const { clinic_id, staff_id, basic_salary, bonus, deductions, pay_date } = req.body;
      const result = await client.execute(
        "INSERT INTO payroll (clinic_id, staff_id, basic_salary, bonus, deductions, pay_date) VALUES (?, ?, ?, ?, ?, ?);",
        [clinic_id, staff_id, basic_salary, bonus, deductions, pay_date]
      );
      res.status(201).json({ payroll_id: result.lastInsertRowid });

    } else if (req.method === "PUT") {
      const { payroll_id, basic_salary, bonus, deductions } = req.body;
      await client.execute(
        "UPDATE payroll SET basic_salary=?, bonus=?, deductions=? WHERE payroll_id=?;",
        [basic_salary, bonus, deductions, payroll_id]
      );
      res.status(200).json({ message: "Updated" });

    } else if (req.method === "DELETE") {
      const { payroll_id } = req.body;
      await client.execute("DELETE FROM payroll WHERE payroll_id=?;", [payroll_id]);
      res.status(200).json({ message: "Deleted" });

    } else res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
}
