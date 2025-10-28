import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function openDb(){ return open({ filename:'./database.db', driver:sqlite3.Database }); }

export default async function handler(req,res){
  const db = await openDb();
  const { method } = req;

  try{
    switch(method){
      case 'GET': return res.json(await db.all('SELECT * FROM stock'));

      case 'POST': {
        const { clinic_id, name, quantity, reorder_level, auto_reorder } = req.body;
        const stmt = await db.run(
          'INSERT INTO stock (clinic_id, name, quantity, reorder_level, auto_reorder) VALUES (?,?,?,?,?)',
          [clinic_id, name, quantity, reorder_level, auto_reorder]
        );
        const item = await db.get('SELECT * FROM stock WHERE stock_id=?', stmt.lastID);
        return res.status(201).json(item);
      }

      case 'PUT': {
        const { stock_id, quantity, reorder_level, auto_reorder } = req.body;
        await db.run(
          'UPDATE stock SET quantity=?, reorder_level=?, auto_reorder=? WHERE stock_id=?',
          [quantity, reorder_level, auto_reorder, stock_id]
        );
        const item = await db.get('SELECT * FROM stock WHERE stock_id=?', stock_id);
        return res.json(item);
      }

      case 'DELETE': {
        const { stock_id } = req.body;
        await db.run('DELETE FROM stock WHERE stock_id=?',[stock_id]);
        return res.json({ success:true });
      }

      default:
        res.setHeader('Allow',['GET','POST','PUT','DELETE']);
        return res.status(405).end();
    }
  } catch(e){ console.error(e); return res.status(500).json({ error:e.message }); }
  finally{ await db.close(); }
}
