import { Router } from "express";
import { z } from "zod";
import { query, queryOne } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { AppError, notFound } from "../lib/errors";
import { eventSelect, escapeLike, serializeEvent, type EventRow } from "../lib/events";
import { idParam, pagination } from "../lib/validation";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get("/stats", async (_req, res) => {
  const totals = await queryOne(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'STUDENT') AS students,
      (SELECT COUNT(*) FROM users WHERE role = 'ORGANIZER') AS organizers,
      (SELECT COUNT(*) FROM events) AS events,
      (SELECT COUNT(*) FROM events WHERE status = 'PUBLISHED' AND (date + end_time) >= LOCALTIMESTAMP) AS upcoming_events,
      (SELECT COUNT(*) FROM events WHERE status = 'PENDING') AS pending_events,
      (SELECT COUNT(*) FROM events WHERE date_trunc('month', date) = date_trunc('month', CURRENT_DATE)) AS events_this_month,
      (SELECT COUNT(*) FROM registrations WHERE status = 'CONFIRMED') AS registrations,
      (SELECT COUNT(*) FROM registrations WHERE attended) AS attended,
      (SELECT COUNT(*) FROM registrations r JOIN events e ON e.id = r.event_id
        WHERE r.status = 'CONFIRMED' AND (e.date + e.end_time) < LOCALTIMESTAMP) AS past_registrations,
      (SELECT COUNT(*) FROM announcements WHERE (category IN ('URGENT', 'IMPORTANT') OR priority = 'HIGH')
        AND published_at <= NOW() AND (expires_at IS NULL OR expires_at > NOW())) AS important_announcements
  `);

  const upcoming = await query<EventRow>(
    `${eventSelect()} WHERE e.status = 'PUBLISHED' AND (e.date + e.end_time) >= LOCALTIMESTAMP
     ORDER BY e.date, e.start_time LIMIT 5`,
    [null],
  );
  const pending = await query<EventRow>(
    `${eventSelect()} WHERE e.status = 'PENDING' ORDER BY e.created_at LIMIT 10`,
    [null],
  );
  const byCategory = await query(
    `SELECT c.slug, c.name_ky, c.name_ru, c.name_en, c.color, COUNT(r.id) AS registrations
     FROM categories c
     LEFT JOIN events e ON e.category_id = c.id
     LEFT JOIN registrations r ON r.event_id = e.id AND r.status = 'CONFIRMED'
     GROUP BY c.id ORDER BY registrations DESC, c.sort_order`,
  );

  res.json({
    totals: {
      ...totals,
      attendance_rate: totals.past_registrations > 0 ? Math.round((totals.attended / totals.past_registrations) * 100) : null,
    },
    upcoming: upcoming.map(serializeEvent),
    pending: pending.map(serializeEvent),
    by_category: byCategory,
  });
});

adminRouter.get("/users", async (req, res) => {
  const q = z
    .object({
      search: z.string().trim().max(100).optional(),
      role: z.enum(["STUDENT", "ORGANIZER", "ADMIN"]).optional(),
      blocked: z.enum(["true", "false"]).optional(),
      ...pagination,
      pageSize: pagination.pageSize.default(20),
    })
    .parse(req.query);

  const params: unknown[] = [];
  const where: string[] = [];
  const p = (v: unknown) => (params.push(v), `$${params.length}`);
  if (q.search) {
    const t = p(`%${escapeLike(q.search)}%`);
    where.push(`(u.full_name ILIKE ${t} OR u.email ILIKE ${t} OR sp.student_code ILIKE ${t} OR sp.group_name ILIKE ${t})`);
  }
  if (q.role) where.push(`u.role = ${p(q.role)}`);
  if (q.blocked) where.push(`u.is_blocked = ${p(q.blocked === "true")}`);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = await queryOne(
    `SELECT COUNT(*) AS n FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id ${whereSql}`,
    params,
  );
  const items = await query(
    `SELECT u.id, u.email, u.full_name, u.role, u.is_blocked, u.is_main_admin, u.language, u.created_at,
            sp.student_code, sp.group_name, sp.faculty,
            (SELECT COUNT(*) FROM registrations r WHERE r.student_id = u.id AND r.status = 'CONFIRMED') AS registrations
     FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id
     ${whereSql} ORDER BY u.is_main_admin DESC, u.created_at DESC, u.id DESC
     LIMIT ${p(q.pageSize)} OFFSET ${p((q.page - 1) * q.pageSize)}`,
    params,
  );
  res.json({ items, total: total.n, page: q.page, pageSize: q.pageSize });
});

adminRouter.patch("/users/:id", async (req, res) => {
  const id = idParam.parse(req.params.id);
  const data = z
    .object({ role: z.enum(["STUDENT", "ORGANIZER", "ADMIN"]).optional(), is_blocked: z.boolean().optional() })
    .parse(req.body);

  const target = await queryOne(`SELECT id, is_main_admin FROM users WHERE id = $1`, [id]);
  if (!target) throw notFound("USER_NOT_FOUND");
  // The main admin always stays an active ADMIN — nobody can block or demote them.
  if (target.is_main_admin && (data.is_blocked || (data.role && data.role !== "ADMIN"))) {
    throw new AppError(403, "MAIN_ADMIN_PROTECTED");
  }

  // Prevent an admin from locking themselves out.
  if (id === req.user!.id && (data.is_blocked || (data.role && data.role !== "ADMIN"))) {
    throw new AppError(400, "VALIDATION_ERROR", [{ field: "id", message: "Cannot demote or block yourself" }]);
  }

  const row = await queryOne(
    `UPDATE users SET role = COALESCE($2, role), is_blocked = COALESCE($3, is_blocked), updated_at = NOW()
     WHERE id = $1 RETURNING id, email, full_name, role, is_blocked`,
    [id, data.role ?? null, data.is_blocked ?? null],
  );
  if (!row) throw notFound("USER_NOT_FOUND");
  res.json(row);
});
