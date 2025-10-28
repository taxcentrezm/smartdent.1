import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function openDb(){ return open({ filename:'./database.db', driver:sqlite3.Database }); }

export default async function handler(req,res){
  const db = await openDb();
  const { method } = req;

  try{
    switch(method){
      case 'GET': return res.json(await db.all('SELECT * FROM treatments'));

      case 'POST': {
        const { patient_id, clinic_id, service_id, staff_id, treatment_date, notes, cost } = req.body;
        const stmt = await db.run(
          'INSERT INTO treatments (patient_id, clinic_id, service_id, staff_id, treatment_date, notes, cost) VALUES (?,?,?,?,?,?,?)',
          [patient_id, clinic_id, service_id, staff_id, treatment_date, notes, cost]
        );
        const treatment = await db.get('SELECT * FROM treatments WHERE treatment_id=?', stmt.lastID);
        return res.status(201).json(treatment);
      }

      case 'PUT': {
        const { treatment_id, notes, cost } = req.body;
        await db.run('UPDATE treatments SET notes=?, cost=? WHERE treatment_id=?',[notes,cost,treatment_id]);
        const treatment = await db.get('SELECT * FROM treatments WHERE treatment_id=?', treatment_id);
        return res.json(treatment);
      }

      case 'DELETE': {
        const { treatment_id } = req.body;
        await db.run('DELETE FROM treatments WHERE treatment_id=?',[treatment_id]);
        return res.json({ success:true });
      }

      default:
        res.setHeader('Allow',['GET','POST','PUT','DELETE']);
        return res.status(405).end();
    }
  } catch(e){ console.error(e); return res.status(500).json({ error:e.message }); }
  finally{ await db.close(); }
}
