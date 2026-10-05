import { pool } from '../db.js';

export async function audit(req, action, resource, resourceId = null) {
  try {
    await pool.execute(
      `INSERT INTO audit_logs (user_id, action, resource, resource_id, ip_address)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user?.id ?? null, action, resource, resourceId, req.ip]
    );
  } catch (err) {
    console.error('Audit logging failed:', err.message);
  }
}
