import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function openDb() { 
  return open({ filename: './database.db', driver: sqlite3.Database }); 
}

export default async function handler(req, res) {
  const db = await openDb();
  const { method } = req;

  try {
    switch(method) {
      case 'GET':
        return res.json(await db.all('SELECT * FROM patients'));
      
      case 'POST': {
        const { full_name, email, phone, clinic_id } = req.body;
        const stmt = await db.run(
          'INSERT INTO patients (full_name,email,phone,clinic_id) VALUES (?,?,?,?)',
          [full_name, email, phone, clinic_id]
        );
        const patient = await db.get('SELECT * FROM patients WHERE patient_id=?', stmt.lastID);
        return res.status(201).json(patient);
      }

      case 'PUT': {
        const { patient_id, full_name, email, phone } = req.body;
        await db.run(
          'UPDATE patients SET full_name=?, email=?, phone=? WHERE patient_id=?',
          [full_name, email, phone, patient_id]
        );
        const patient = await db.get('SELECT * FROM patients WHERE patient_id=?', patient_id);
        return res.json(patient);
      }

      case 'DELETE': {
        const { patient_id } = req.body;
        await db.run('DELETE FROM patients WHERE patient_id=?', [patient_id]);
        return res.json({ success: true });
      }

      default:
        res.setHeader('Allow',['GET','POST','PUT','DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch(e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  } finally { await db.close(); }
}
