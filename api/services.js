import { client } from "../db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await client.execute("SELECT * FROM services;");
      const services = result.rows.map(row => ({
        service_id: row.service_id,
        clinic_id: row.clinic_id,
        name: row.name,
        description: row.description,
        price: row.price
      }));
      return res.status(200).json(services);

    } else if (req.method === "POST") {
      const { clinic_id, name, description, price } = req.body;
      const result = await client.execute(
        "INSERT INTO services (clinic_id, name, description, price) VALUES (?, ?, ?, ?);",
        [clinic_id, name, description, price]
      );
      return res.status(201).json({ service_id: result.lastInsertRowid });

    } else if (req.method === "PUT") {
      const { service_id, name, description, price } = req.body;
      await client.execute(
        "UPDATE services SET name=?, description=?, price=? WHERE service_id=?;",
        [name, description, price, service_id]
      );
      return res.status(200).json({ message: "Updated" });

    } else if (req.method === "DELETE") {
      const { service_id } = req.body;
      await client.execute("DELETE FROM services WHERE service_id=?;", [service_id]);
      return res.status(200).json({ message: "Deleted" });

    } else {
      res.status(405).json({ error: "Method not allowed" });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
}
