import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function openDb(){ return open({ filename:'./database.db', driver:sqlite3.Database }); }

export default async function handler(req,res){
  const db = await openDb();
  const { method } = req;

  try{
    switch(method){
      case 'GET':
        return res.json(await db.all('SELECT * FROM payrolls'));

      case 'POST': {
        const { staff_id, clinic_id, basic_salary, bonus, deductions, pay_date } = req.body;
        const stmt = await db.run(
          'INSERT INTO payrolls (staff_id, clinic_id, basic_salary, bonus, deductions, pay_date) VALUES (?,?,?,?,?,?)',
          [staff_id, clinic_id, basic_salary, bonus, deductions, pay_date]
        );
        const payroll = await db.get('SELECT * FROM payrolls WHERE payroll_id=?', stmt.lastID);
        return res.status(201).json(payroll);
      }

      case 'PUT': {
        const { payroll_id, bonus, deductions } = req.body;
        await db.run('UPDATE payrolls SET bonus=?, deductions=? WHERE payroll_id=?',[bonus,deductions,payroll_id]);
        const payroll = await db.get('SELECT * FROM payrolls WHERE payroll_id=?', payroll_id);
        return res.json(payroll);
      }

      case 'DELETE': {
        const { payroll_id } = req.body;
        await db.run('DELETE FROM payrolls WHERE payroll_id=?',[payroll_id]);
        return res.json({ success:true });
      }

      default:
        res.setHeader('Allow',['GET','POST','PUT','DELETE']);
        return res.status(405).end();
    }
  } catch(e){ console.error(e); return res.status(500).json({ error:e.message }); }
  finally{ await db.close(); }
}
