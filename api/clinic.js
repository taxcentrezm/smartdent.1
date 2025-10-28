import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function openDb() {
  return open({ filename: './database.db', driver: sqlite3.Database });
}

export default async function handler(req, res) {
  const db = await openDb();
  const { method } = req;

  try {
    switch (method) {
      case 'GET': {
        const clinics = await db.all('SELECT * FROM clinics');
        const integrations = await db.all('SELECT * FROM integrations');
        const result = clinics.map(clinic => ({
          ...clinic,
          integrations: integrations.filter(i => i.clinic_id === clinic.clinic_id)
        }));
        return res.json(result);
      }
      case 'POST': {
        const { name, address, phone, email } = req.body;
        const stmt = await db.run(
          `INSERT INTO clinics (name, address, phone, email) VALUES (?,?,?,?)`,
          [name, address || '', phone || '', email || '']
        );
        const newClinic = await db.get('SELECT * FROM clinics WHERE clinic_id=?', stmt.lastID);
        return res.status(201).json(newClinic);
      }
      case 'PUT': {
        const { clinic_id, name, address, phone, email } = req.body;
        await db.run(
          `UPDATE clinics SET name=?, address=?, phone=?, email=? WHERE clinic_id=?`,
          [name, address, phone, email, clinic_id]
        );
        const updatedClinic = await db.get('SELECT * FROM clinics WHERE clinic_id=?', clinic_id);
        return res.json(updatedClinic);
      }
      default:
        res.setHeader('Allow', ['GET','POST','PUT']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  } finally { await db.close(); }
}
