import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { query, queryOne, transaction } from "../db";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth";
import { AppError, forbidden, notFound } from "../lib/errors";
import { hasSomeTranslation, idParam, optText, pagination, uploadPath } from "../lib/validation";
import {
  eventSelect,
  EVENT_STATUSES,
  PUBLIC_STATUSES,
  type EventRow,
  type EventStatus,
  canManageEvent,
  canViewEvent,
  escapeLike,
  registrationState,
  serializeEvent,
} from "../lib/events";
import { notifyEvent, notifyParticipants } from "../lib/notifications";
import { awardAchievements } from "../lib/achievements";

export const eventsRouter = Router();

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/);
const fkId = z.number().int().positive().nullish().transform((v) => v ?? null);

const eventFields = {
  title_ky: optText(200),
  title_ru: optText(200),
  title_en: optText(200),
  description_ky: optText(20_000),
  description_ru: optText(20_000),
  description_en: optText(20_000),
  requirements_ky: optText(5_000),
  requirements_ru: optText(5_000),
  requirements_en: optText(5_000),
  program_ky: optText(10_000),
  program_ru: optText(10_000),
  program_en: optText(10_000),
  image: uploadPath,
  category_id: fkId,
  venue_id: fkId,
  organizer_id: fkId,
  date: dateStr,
  start_time: timeStr,
  end_time: timeStr,
  capacity: z.number().int().positive().max(100_000).nullish().transform((v) => v ?? null),
  registration_deadline: z.iso.datetime({ offset: true }).nullish().transform((v) => v ?? null),
  status: z.enum(EVENT_STATUSES),
  contact: optText(300),
};

const createSchema = z
  .object({ ...eventFields, status: eventFields.status.default("DRAFT") })
  .refine(hasSomeTranslation("title"), { path: ["title_ru"], message: "Title is required in at least one language" })
  .refine((e) => e.end_time > e.start_time, { path: ["end_time"], message: "End time must be after start time" });

const updateSchema = z.object(eventFields).partial();

/** Statuses an organizer may set; approval and publishing stay with admins. */
const ORGANIZER_STATUSES: EventStatus[] = ["DRAFT", "PENDING", "CANCELLED"];

const listSchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(200).optional(), // slug or comma-separated slugs
  period: z.enum(["today", "tomorrow", "week", "month", "upcoming", "past"]).optional(),
  date: dateStr.optional(),
  date_from: dateStr.optional(),
  date_to: dateStr.optional(),
  venue: z.coerce.number().int().positive().optional(),
  status: z.string().trim().max(100).optional(), // comma-separated
  organizer: z.coerce.number().int().positive().optional(),
  mine: z.enum(["true", "false"]).optional(),
  sort: z.enum(["date_asc", "date_desc", "newest", "popular"]).default("date_asc"),
  ...pagination,
});

const PERIOD_SQL: Record<string, string> = {
  today: `e.date = CURRENT_DATE`,
  tomorrow: `e.date = CURRENT_DATE + 1`,
  week: `e.date BETWEEN CURRENT_DATE AND (date_trunc('week', CURRENT_DATE) + INTERVAL '6 days')::date`,
  month: `e.date BETWEEN CURRENT_DATE AND (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date`,
  upcoming: `(e.date + e.end_time) >= LOCALTIMESTAMP`,
  past: `(e.date + e.end_time) < LOCALTIMESTAMP`,
};

const SORT_SQL: Record<string, string> = {
  date_asc: `e.date ASC, e.start_time ASC, e.id`,
  date_desc: `e.date DESC, e.start_time DESC, e.id`,
  newest: `e.created_at DESC, e.id DESC`,
  popular: `registered_count DESC, e.date ASC, e.id`,
};

eventsRouter.get("/", optionalAuth, async (req, res) => {
  const q = listSchema.parse(req.query);
  const user = req.user;
  const params: unknown[] = [];
  const where: string[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  // Visibility: admins see everything; organizers also see their own drafts; everyone else only public statuses.
  if (user?.role !== "ADMIN") {
    const visible = `e.status = ANY(${p(PUBLIC_STATUSES)}::text[])`;
    where.push(user?.role === "ORGANIZER" ? `(${visible} OR e.organizer_id = ${p(user.id)})` : visible);
  }
  if (q.mine === "true" && user) where.push(`e.organizer_id = ${p(user.id)}`);
  if (q.organizer) where.push(`e.organizer_id = ${p(q.organizer)}`);

  if (q.search) {
    const term = p(`%${escapeLike(q.search)}%`);
    const cols = [
      "e.title_ky", "e.title_ru", "e.title_en",
      "e.description_ky", "e.description_ru", "e.description_en",
      "c.name_ky", "c.name_ru", "c.name_en", "o.full_name",
    ];
    where.push(`(${cols.map((c) => `${c} ILIKE ${term}`).join(" OR ")})`);
  }
  if (q.category) where.push(`c.slug = ANY(${p(q.category.split(",").map((s) => s.trim().toLowerCase()))}::text[])`);
  if (q.status) {
    const statuses = q.status.split(",").map((s) => s.trim().toUpperCase());
    where.push(`e.status = ANY(${p(statuses)}::text[])`);
  }
  if (q.period) where.push(PERIOD_SQL[q.period]!);
  if (q.date) where.push(`e.date = ${p(q.date)}`);
  if (q.date_from) where.push(`e.date >= ${p(q.date_from)}`);
  if (q.date_to) where.push(`e.date <= ${p(q.date_to)}`);
  if (q.venue) where.push(`e.venue_id = ${p(q.venue)}`);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const countParams = [...params];
  const offset = (q.page - 1) * q.pageSize;
  const userParam = p(user?.id ?? null);

  const [rows, totalRow] = await Promise.all([
    query<EventRow>(
      `${eventSelect(userParam)} ${whereSql} ORDER BY ${SORT_SQL[q.sort]} LIMIT ${p(q.pageSize)} OFFSET ${p(offset)}`,
      params,
    ),
    queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM events e
       LEFT JOIN categories c ON c.id = e.category_id
       LEFT JOIN users o ON o.id = e.organizer_id
       ${whereSql}`,
      countParams,
    ),
  ]);

  res.json({ items: rows.map(serializeEvent), total: totalRow?.total ?? 0, page: q.page, pageSize: q.pageSize });
});

async function loadEvent(id: number, userId: number | null, db?: Parameters<typeof query>[2]) {
  return queryOne<EventRow>(`${eventSelect()} WHERE e.id = $2`, [userId, id], db);
}

eventsRouter.get("/:id", optionalAuth, async (req, res) => {
  const id = idParam.parse(req.params.id);
  const event = await loadEvent(id, req.user?.id ?? null);
  if (!event || !canViewEvent(req.user, event)) throw notFound("EVENT_NOT_FOUND");
  res.json({ ...serializeEvent(event), can_manage: canManageEvent(req.user, event) });
});

eventsRouter.post("/", requireAuth, requireRole("ORGANIZER", "ADMIN"), async (req, res) => {
  const data = createSchema.parse(req.body);
  const user = req.user!;

  if (user.role === "ORGANIZER") {
    if (!ORGANIZER_STATUSES.includes(data.status)) throw forbidden();
    data.organizer_id = user.id;
  } else {
    data.organizer_id ??= user.id;
  }

  const cols = Object.keys(data) as (keyof typeof data)[];
  const row = await queryOne(
    `INSERT INTO events (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`,
    cols.map((c) => data[c]),
  );
  const event = await loadEvent(row.id, user.id);
  res.status(201).json(serializeEvent(event!));
});

eventsRouter.patch("/:id", requireAuth, requireRole("ORGANIZER", "ADMIN"), async (req, res) => {
  const id = idParam.parse(req.params.id);
  const data = updateSchema.parse(req.body);
  const user = req.user!;

  const result = await transaction(async (db) => {
    const before = await loadEvent(id, user.id, db);
    if (!before) throw notFound("EVENT_NOT_FOUND");
    if (!canManageEvent(user, before)) throw forbidden();

    if (user.role === "ORGANIZER") {
      delete data.organizer_id;
      if (data.status && !ORGANIZER_STATUSES.includes(data.status)) throw forbidden();
    }
    if (data.capacity != null && data.capacity < before.registered_count) {
      throw new AppError(400, "VALIDATION_ERROR", [{ field: "capacity", message: "Capacity below registrations" }]);
    }

    const cols = Object.keys(data).filter((k) => data[k as keyof typeof data] !== undefined) as (keyof typeof data)[];
    const timeChanged =
      (data.date !== undefined && data.date !== before.date) ||
      (data.start_time !== undefined && data.start_time.slice(0, 5) !== before.start_time) ||
      (data.end_time !== undefined && data.end_time.slice(0, 5) !== before.end_time);
    if (cols.length > 0) {
      const sets = cols.map((c, i) => `${c} = $${i + 2}`);
      if (timeChanged) sets.push("reminder_sent = FALSE");
      await query(
        `UPDATE events SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $1`,
        [id, ...cols.map((c) => data[c])],
        db,
      );
    }

    const after = (await loadEvent(id, user.id, db))!;

    // Tell registered students about changes that affect them.
    if (after.status === "CANCELLED" && before.status !== "CANCELLED") {
      await notifyParticipants("EVENT_CANCELLED", after, db);
    } else if (after.status !== "CANCELLED") {
      if (timeChanged) await notifyParticipants("EVENT_CHANGED", after, db);
      if (data.venue_id !== undefined && data.venue_id !== before.venue_id) await notifyParticipants("VENUE_CHANGED", after, db);
    }
    return after;
  });

  res.json(serializeEvent(result));
});

eventsRouter.delete("/:id", requireAuth, requireRole("ORGANIZER", "ADMIN"), async (req, res) => {
  const id = idParam.parse(req.params.id);
  const event = await queryOne(`SELECT id, organizer_id, status FROM events WHERE id = $1`, [id]);
  if (!event) throw notFound("EVENT_NOT_FOUND");
  // Organizers may only delete their own drafts; anything visible must be cancelled instead.
  const allowed = req.user!.role === "ADMIN" || (canManageEvent(req.user, event) && event.status === "DRAFT");
  if (!allowed) throw forbidden();
  await query(`DELETE FROM events WHERE id = $1`, [id]);
  res.status(204).end();
});

// ---------- Registration ----------

const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: { code: "TOO_MANY_REQUESTS" } });
  },
});

const registrationSchema = z.object({
  full_name: z.string().trim().min(2).max(150),
  student_code: z.string().trim().min(1).max(50),
  group_name: z.string().trim().min(1).max(50),
  faculty: optText(150),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: optText(30),
  extra_info: optText(1000),
});

eventsRouter.post("/:id/register", requireAuth, registerLimiter, async (req, res) => {
  const id = idParam.parse(req.params.id);
  const data = registrationSchema.parse(req.body);
  const user = req.user!;

  const event = await transaction(async (db) => {
    // Lock the event row so two students can't take the last seat at the same time.
    const locked = await queryOne(`SELECT id FROM events WHERE id = $1 FOR UPDATE`, [id], db);
    if (!locked) throw notFound("EVENT_NOT_FOUND");
    const event = (await loadEvent(id, user.id, db))!;
    if (!canViewEvent(user, event)) throw notFound("EVENT_NOT_FOUND");

    if (event.my_registration === "CONFIRMED" || event.my_registration === "PENDING") {
      throw new AppError(409, "ALREADY_REGISTERED");
    }
    if (event.my_registration === "REJECTED") throw forbidden();

    const state = registrationState(event);
    if (state === "CANCELLED") throw new AppError(409, "EVENT_CANCELLED");
    if (state === "FULL") throw new AppError(409, "EVENT_FULL");
    if (state !== "OPEN") throw new AppError(409, "REGISTRATION_CLOSED");

    const values = [id, user.id, data.full_name, data.student_code, data.group_name, data.faculty, data.email, data.phone, data.extra_info];
    // A previously cancelled registration is re-activated (the event_id+student_id pair is UNIQUE).
    await query(
      `INSERT INTO registrations (event_id, student_id, full_name, student_code, group_name, faculty, email, phone, extra_info)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (event_id, student_id) DO UPDATE SET
         status = 'CONFIRMED', full_name = EXCLUDED.full_name, student_code = EXCLUDED.student_code,
         group_name = EXCLUDED.group_name, faculty = EXCLUDED.faculty, email = EXCLUDED.email,
         phone = EXCLUDED.phone, extra_info = EXCLUDED.extra_info, registered_at = NOW(), cancelled_at = NULL`,
      values,
      db,
    );

    // Remember the student's details so the next registration form is pre-filled.
    await query(
      `INSERT INTO student_profiles (user_id, student_code, group_name, faculty, phone) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         student_code = COALESCE(student_profiles.student_code, EXCLUDED.student_code),
         group_name   = COALESCE(student_profiles.group_name, EXCLUDED.group_name),
         faculty      = COALESCE(student_profiles.faculty, EXCLUDED.faculty),
         phone        = COALESCE(student_profiles.phone, EXCLUDED.phone)`,
      [user.id, data.student_code, data.group_name, data.faculty, data.phone],
      db,
    );

    await notifyEvent("REGISTRATION", event, [user.id], db);
    return (await loadEvent(id, user.id, db))!;
  });

  res.status(201).json(serializeEvent(event));
});

eventsRouter.delete("/:id/register", requireAuth, async (req, res) => {
  const id = idParam.parse(req.params.id);
  const user = req.user!;
  const event = await loadEvent(id, user.id);
  if (!event || !canViewEvent(user, event)) throw notFound("EVENT_NOT_FOUND");
  if (event.my_registration !== "CONFIRMED" && event.my_registration !== "PENDING") {
    throw new AppError(409, "NOT_REGISTERED");
  }
  if (event.has_started) throw new AppError(409, "REGISTRATION_CLOSED");

  await query(
    `UPDATE registrations SET status = 'CANCELLED', cancelled_at = NOW() WHERE event_id = $1 AND student_id = $2`,
    [id, user.id],
  );
  res.json(serializeEvent((await loadEvent(id, user.id))!));
});

// ---------- Participants (admin / owning organizer) ----------

async function assertCanManage(id: number, req: Parameters<Parameters<typeof eventsRouter.get>[1]>[0]) {
  const event = await queryOne(`SELECT id, organizer_id FROM events WHERE id = $1`, [id]);
  if (!event) throw notFound("EVENT_NOT_FOUND");
  if (!canManageEvent(req.user, event)) throw forbidden();
}

eventsRouter.get("/:id/registrations", requireAuth, requireRole("ORGANIZER", "ADMIN"), async (req, res) => {
  const id = idParam.parse(req.params.id);
  await assertCanManage(id, req);
  const rows = await query(
    `SELECT r.id, r.student_id, r.status, r.full_name, r.student_code, r.group_name, r.faculty,
            r.email, r.phone, r.extra_info, r.attended, r.registered_at, r.cancelled_at
     FROM registrations r WHERE r.event_id = $1
     ORDER BY (r.status = 'CANCELLED'), r.registered_at`,
    [id],
  );
  res.json(rows);
});

const registrationUpdateSchema = z.object({
  attended: z.boolean().optional(),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "REJECTED"]).optional(),
});

eventsRouter.patch("/:id/registrations/:regId", requireAuth, requireRole("ORGANIZER", "ADMIN"), async (req, res) => {
  const id = idParam.parse(req.params.id);
  const regId = idParam.parse(req.params.regId);
  const data = registrationUpdateSchema.parse(req.body);
  await assertCanManage(id, req);

  const row = await transaction(async (db) => {
    const reg = await queryOne(
      `UPDATE registrations SET
         attended = COALESCE($3, attended),
         status = COALESCE($4, status),
         cancelled_at = CASE WHEN $4 = 'CANCELLED' THEN NOW() ELSE cancelled_at END
       WHERE id = $1 AND event_id = $2 RETURNING *`,
      [regId, id, data.attended ?? null, data.status ?? null],
      db,
    );
    if (!reg) throw notFound();
    if (data.attended) await awardAchievements(reg.student_id, db);
    return reg;
  });
  res.json(row);
});
