import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function openDb() { return open({ filename: './database.db', driver: sqlite3.Database }); }

export default async function handler(req,res) {
  const db = await openDb();
  const { method } = req;

  try{
    switch(method){
      case 'GET':
        return res.json(await db.all('SELECT * FROM appointments'));

      case 'POST': {
        const { patient_id, clinic_id, service_id, staff_id, appointment_date, status } = req.body;
        const stmt = await db.run(
          'INSERT INTO appointments (patient_id, clinic_id, service_id, staff_id, appointment_date, status) VALUES (?,?,?,?,?,?)',
          [patient_id, clinic_id, service_id, staff_id, appointment_date, status]
        );
        const appointment = await db.get('SELECT * FROM appointments WHERE appointment_id=?', stmt.lastID);
        return res.status(201).json(appointment);
      }

      case 'PUT': {
        const { appointment_id, staff_id, appointment_date, status } = req.body;
        await db.run(
          'UPDATE appointments SET staff_id=?, appointment_date=?, status=? WHERE appointment_id=?',
          [staff_id, appointment_date, status, appointment_id]
        );
        const appointment = await db.get('SELECT * FROM appointments WHERE appointment_id=?', appointment_id);
        return res.json(appointment);
      }

      case 'DELETE': {
        const { appointment_id } = req.body;
        await db.run('DELETE FROM appointments WHERE appointment_id=?', [appointment_id]);
        return res.json({ success:true });
      }

      default:
        res.setHeader('Allow',['GET','POST','PUT','DELETE']);
        return res.status(405).end();
    }
  } catch(e){ console.error(e); return res.status(500).json({ error:e.message }); }
  finally{ await db.close(); }
}
