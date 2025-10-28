import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function openDb() { return open({ filename: './database.db', driver: sqlite3.Database }); }

export default async function handler(req,res) {
  const db = await openDb();
  const { method } = req;

  try {
    switch(method){
      case 'GET':
        return res.json(await db.all('SELECT * FROM services'));

      case 'POST': {
        const { name, description, price, clinic_id } = req.body;
        const stmt = await db.run(
          'INSERT INTO services (name, description, price, clinic_id) VALUES (?,?,?,?)',
          [name, description, price, clinic_id]
        );
        const service = await db.get('SELECT * FROM services WHERE service_id=?', stmt.lastID);
        return res.status(201).json(service);
      }

      case 'PUT': {
        const { service_id, name, description, price } = req.body;
        await db.run(
          'UPDATE services SET name=?, description=?, price=? WHERE service_id=?',
          [name, description, price, service_id]
        );
        const service = await db.get('SELECT * FROM services WHERE service_id=?', service_id);
        return res.json(service);
      }

      case 'DELETE': {
        const { service_id } = req.body;
        await db.run('DELETE FROM services WHERE service_id=?', [service_id]);
        return res.json({ success:true });
      }

      default:
        res.setHeader('Allow',['GET','POST','PUT','DELETE']);
        return res.status(405).end();
    }
  } catch(e){ console.error(e); return res.status(500).json({ error:e.message }); }
  finally{ await db.close(); }
}
