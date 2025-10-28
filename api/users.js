import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function openDb() { return open({ filename: './database.db', driver: sqlite3.Database }); }

export default async function handler(req, res) {
  const db = await openDb();
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        return res.json(await db.all('SELECT * FROM users'));
      case 'POST': {
        const { full_name, email, password, role, clinic_id } = req.body;
        const stmt = await db.run(
          `INSERT INTO users (full_name, email, password, role, clinic_id) VALUES (?,?,?,?,?)`,
          [full_name, email, password, role, clinic_id]
        );
        const user = await db.get('SELECT * FROM users WHERE user_id=?', stmt.lastID);
        return res.status(201).json(user);
      }
      case 'PUT': {
        const { user_id, full_name, email, role } = req.body;
        await db.run(
          `UPDATE users SET full_name=?, email=?, role=? WHERE user_id=?`,
          [full_name, email, role, user_id]
        );
        const user = await db.get('SELECT * FROM users WHERE user_id=?', user_id);
        return res.json(user);
      }
      case 'DELETE': {
        const { user_id } = req.body;
        await db.run(`DELETE FROM users WHERE user_id=?`, [user_id]);
        return res.json({ success: true });
      }
      default: res.setHeader('Allow',['GET','POST','PUT','DELETE']); return res.status(405).end();
    }
  } catch(e) { console.error(e); return res.status(500).json({ error: e.message }); }
  finally { await db.close(); }
}
