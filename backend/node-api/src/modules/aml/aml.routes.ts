import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../core/database/postgres.client';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { NotFoundError, ValidationError } from '../../core/errors';

const ALLOWED_STATUSES = ['Open', 'UnderReview', 'Escalated', 'Cleared', 'SarFiled'];

interface AlertRow {
  id:          string;
  user_id:     string;
  rule_code:   string;
  description: string;
  severity:    string;
  status:      string;
  amount:      string;
  currency:    string;
  sar_ref:     string | null;
  created_at:  Date;
}

function mapAlert(r: AlertRow) {
  return {
    id:          r.id,
    userId:      r.user_id,
    ruleCode:    r.rule_code,
    description: r.description,
    severity:    r.severity,
    status:      r.status,
    amount:      parseFloat(r.amount),
    currency:    r.currency,
    sarRef:      r.sar_ref,
    createdAt:   r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

/**
 * Native AML alerts API backed by the aml.alerts table.
 * Replaces the proxy to the .NET AML service so the compliance page works
 * without that service being deployed.
 */
export function createAmlRouter(): Router {
  const router = Router();

  router.use(authenticate, authorize('ADMIN', 'L2_ADMIN', 'COMPLIANCE'));

  router.get('/alerts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit  = Math.min(100, parseInt(String(req.query['limit'] ?? 50), 10) || 50);
      const offset = Math.max(0,   parseInt(String(req.query['offset'] ?? 0), 10) || 0);
      const status = req.query['status'] ? String(req.query['status']) : undefined;

      const conditions: string[] = [];
      const values: unknown[]    = [];
      if (status) {
        conditions.push('status = $1');
        values.push(status);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const r = await db.query<AlertRow>(
        `SELECT id, user_id, rule_code, description, severity, status,
                amount, currency, sar_ref, created_at
         FROM aml.alerts ${where}
         ORDER BY created_at DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset],
      );

      res.json({ success: true, data: r.rows.map(mapAlert) });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/alerts/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id     = req.params['id']!;
      const status = String(req.body['status'] ?? '');
      const sarRef = req.body['sarRef'] != null ? String(req.body['sarRef']) : null;

      if (!ALLOWED_STATUSES.includes(status)) {
        throw new ValidationError(`Invalid status '${status}'. Allowed: ${ALLOWED_STATUSES.join(', ')}`);
      }

      const r = await db.query<AlertRow>(
        `UPDATE aml.alerts
         SET status = $1, sar_ref = COALESCE($2, sar_ref), updated_at = NOW()
         WHERE id = $3
         RETURNING id, user_id, rule_code, description, severity, status,
                   amount, currency, sar_ref, created_at`,
        [status, sarRef, id],
      );

      if (!r.rows[0]) throw new NotFoundError('AML alert');
      res.json({ success: true, data: mapAlert(r.rows[0]) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
