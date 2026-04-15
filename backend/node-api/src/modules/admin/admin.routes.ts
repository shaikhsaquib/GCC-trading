import { Router, Response } from 'express';
import { db } from '../../shared/db/postgres';
import { auditService } from '../audit/audit.service';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { asyncHandler } from '../../shared/middleware/error.middleware';
import { AuthenticatedRequest, UserRole } from '../../shared/types';

const router = Router();

// ── All admin routes require at minimum ADMIN_L1 ─────────────────────────────
router.use(authenticate, requireRole(UserRole.ADMIN_L1, UserRole.ADMIN_L2, UserRole.SUPER_ADMIN));

/** GET /admin/dashboard — platform KPIs */
router.get('/dashboard', asyncHandler(async (_req, res: Response) => {
  const [users, bonds, orders, kyc] = await Promise.all([
    db.query<{ total: string; active: string; new_week: string; suspended: string }>(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS new_week,
         COUNT(*) FILTER (WHERE status = 'SUSPENDED') AS suspended
       FROM auth.users WHERE is_deleted = false`,
    ),
    db.query<{ active: string; total_aum: string }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active,
              COALESCE(SUM(current_price * face_value), 0) AS total_aum
       FROM bonds.listings`,
    ),
    db.query<{ open: string; today_volume: string }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'OPEN') AS open,
              COALESCE(SUM(filled_quantity * avg_fill_price), 0) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS today_volume
       FROM trading.orders`,
    ),
    db.query<{ pending: string }>(
      `SELECT COUNT(*) AS pending FROM kyc.submissions WHERE status IN ('SUBMITTED','MANUAL_REVIEW')`,
    ),
  ]);

  res.json({
    success: true,
    data: {
      users:       users.rows[0],
      bonds:       bonds.rows[0],
      orders:      orders.rows[0],
      kyc_pending: kyc.rows[0].pending,
    },
  });
}));

/** GET /admin/users — user management table (FSD §ADM-002) */
router.get('/users', asyncHandler(async (req, res: Response) => {
  const { search, status, role, page = '1', limit = '20' } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions: string[] = ['u.is_deleted = false'];
  const params: unknown[]    = [];

  if (status) { conditions.push(`u.status = $${params.length + 1}`); params.push(status); }
  if (role)   { conditions.push(`u.role   = $${params.length + 1}`); params.push(role); }

  const where = conditions.join(' AND ');

  const result = await db.query(
    `SELECT u.id, u.first_name, u.last_name, u.status, u.role, u.risk_level,
            u.preferred_currency, u.created_at, u.two_fa_enabled,
            k.status AS kyc_status
     FROM auth.users u
     LEFT JOIN kyc.submissions k ON k.user_id = u.id AND k.status IN ('APPROVED','AUTO_APPROVED')
     WHERE ${where}
     ORDER BY u.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, parseInt(limit), offset],
  );

  res.json({ success: true, data: result.rows });
}));

/** PATCH /admin/users/:id/suspend — FSD §ADM-002, requireRole L2+ */
router.patch(
  '/users/:id/suspend',
  requireRole(UserRole.ADMIN_L2, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    await db.query(`UPDATE auth.users SET status = 'SUSPENDED' WHERE id = $1`, [id]);
    await auditService.log({
      event_type: 'USER_SUSPENDED',
      action:     'suspend',
      actor_id:   req.user!.id,
      actor_role: req.user!.role,
      target_id:  id,
      target_type: 'USER',
    });
    res.json({ success: true, data: { status: 'SUSPENDED' } });
  }),
);

/** PATCH /admin/users/:id/activate */
router.patch(
  '/users/:id/activate',
  requireRole(UserRole.ADMIN_L2, UserRole.SUPER_ADMIN),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    await db.query(`UPDATE auth.users SET status = 'ACTIVE' WHERE id = $1 AND status = 'SUSPENDED'`, [id]);
    await auditService.log({
      event_type: 'USER_ACTIVATED',
      action:     'activate',
      actor_id:   req.user!.id,
      actor_role: req.user!.role,
      target_id:  id,
      target_type: 'USER',
    });
    res.json({ success: true, data: { status: 'ACTIVE' } });
  }),
);

/** GET /admin/bonds — bond listing management (FSD §ADM-003) */
router.get('/bonds', asyncHandler(async (req, res: Response) => {
  const { status, page = '1', limit = '20' } = req.query as Record<string, string>;
  const result = await db.query(
    `SELECT * FROM bonds.listings ${status ? `WHERE status = $1` : ''}
     ORDER BY created_at DESC LIMIT $${status ? 2 : 1} OFFSET $${status ? 3 : 2}`,
    status
      ? [status, parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]
      : [parseInt(limit), (parseInt(page) - 1) * parseInt(limit)],
  );
  res.json({ success: true, data: result.rows });
}));

/** GET /admin/audit — audit trail viewer (FSD §AML-004) */
router.get('/audit', asyncHandler(async (req, res: Response) => {
  const { actor_id, target_id, event_type, from, to, page, limit } = req.query as Record<string, string>;
  const data = await auditService.query({ actor_id, target_id, event_type, from, to, page: +page || 1, limit: +limit || 50 });
  res.json({ success: true, data });
}));

/** GET /admin/reports/daily — FSD §18 */
router.get('/reports/daily', asyncHandler(async (_req, res: Response) => {
  const result = await db.query(`
    SELECT
      DATE(o.created_at) AS date,
      COUNT(DISTINCT o.id) AS total_trades,
      COALESCE(SUM(o.filled_quantity * o.avg_fill_price), 0) AS volume,
      COUNT(DISTINCT u.id) FILTER (WHERE DATE(u.created_at) = DATE(o.created_at)) AS new_users,
      COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'DEPOSIT'), 0) AS total_deposits,
      COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'WITHDRAWAL'), 0) AS total_withdrawals
    FROM trading.orders o
    FULL OUTER JOIN auth.users u ON TRUE
    FULL OUTER JOIN wallet.transactions t ON DATE(t.created_at) = DATE(o.created_at)
    WHERE o.status IN ('FILLED','SETTLED','PENDING_SETTLEMENT')
    GROUP BY DATE(o.created_at)
    ORDER BY date DESC
    LIMIT 30
  `);
  res.json({ success: true, data: result.rows });
}));

export default router;
