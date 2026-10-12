import { Router } from "express";
import { z } from "zod";
import { query, queryOne, transaction } from "../db";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth";
import { notFound } from "../lib/errors";
import { escapeLike } from "../lib/events";
import { hasSomeTranslation, idParam, optText, pagination, uploadPath } from "../lib/validation";
import { notifyAnnouncement } from "../lib/notifications";

export const announcementsRouter = Router();

const CATEGORIES = ["IMPORTANT", "ACADEMIC", "EVENT", "GENERAL", "URGENT"] as const;
const PRIORITIES = ["LOW", "NORMAL", "HIGH"] as const;

const fields = {
  title_ky: optText(200),
  title_ru: optText(200),
  title_en: optText(200),
  content_ky: optText(20_000),
  content_ru: optText(20_000),
  content_en: optText(20_000),
  priority: z.enum(PRIORITIES),
  category: z.enum(CATEGORIES),
  is_pinned: z.boolean(),
  image: uploadPath,
  attachment: uploadPath,
  published_at: z.iso.datetime({ offset: true }).nullish().transform((v) => v ?? undefined),
  expires_at: z.iso.datetime({ offset: true }).nullish().transform((v) => v ?? null),
};

const createSchema = z
  .object({
    ...fields,
    priority: fields.priority.default("NORMAL"),
    category: fields.category.default("GENERAL"),
    is_pinned: fields.is_pinned.default(false),
  })
  .refine(hasSomeTranslation("title"), { path: ["title_ru"], message: "Title is required in at least one language" });

const updateSchema = z.object(fields).partial();

const SELECT = `
  SELECT a.*, CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('id', u.id, 'full_name', u.full_name) END AS author,
         (a.published_at <= NOW() AND (a.expires_at IS NULL OR a.expires_at > NOW())) AS is_active
  FROM announcements a LEFT JOIN users u ON u.id = a.author_id`;

/** Pinned first, then urgent/important, then by priority, then newest. */
const ORDER = `
  ORDER BY a.is_pinned DESC,
           (a.category IN ('URGENT', 'IMPORTANT')) DESC,
           CASE a.priority WHEN 'HIGH' THEN 2 WHEN 'NORMAL' THEN 1 ELSE 0 END DESC,
           a.published_at DESC, a.id DESC`;

const isImportant = (a: { category: string; priority: string }) =>
  a.category === "URGENT" || a.category === "IMPORTANT" || a.priority === "HIGH";

announcementsRouter.get("/", optionalAuth, async (req, res) => {
  const q = z
    .object({
      search: z.string().trim().max(100).optional(),
      category: z.enum(CATEGORIES).optional(),
      all: z.enum(["true", "false"]).optional(), // admins: include scheduled and expired
      ...pagination,
    })
    .parse(req.query);

  const params: unknown[] = [];
  const where: string[] = [];
  const p = (v: unknown) => (params.push(v), `$${params.length}`);

  if (!(q.all === "true" && req.user?.role === "ADMIN")) {
    where.push(`a.published_at <= NOW() AND (a.expires_at IS NULL OR a.expires_at > NOW())`);
  }
  if (q.category) where.push(`a.category = ${p(q.category)}`);
  if (q.search) {
    const t = p(`%${escapeLike(q.search)}%`);
    where.push(`(${["title_ky", "title_ru", "title_en", "content_ky", "content_ru", "content_en"].map((c) => `a.${c} ILIKE ${t}`).join(" OR ")})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM announcements a ${whereSql}`, params);
  const items = await query(
    `${SELECT} ${whereSql} ${ORDER} LIMIT ${p(q.pageSize)} OFFSET ${p((q.page - 1) * q.pageSize)}`,
    params,
  );
  res.json({ items, total: total?.n ?? 0, page: q.page, pageSize: q.pageSize });
});

announcementsRouter.get("/:id", optionalAuth, async (req, res) => {
  const id = idParam.parse(req.params.id);
  const a = await queryOne(`${SELECT} WHERE a.id = $1`, [id]);
  if (!a || (!a.is_active && req.user?.role !== "ADMIN")) throw notFound("ANNOUNCEMENT_NOT_FOUND");
  res.json(a);
});

announcementsRouter.post("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const data = createSchema.parse(req.body);
  const row = await transaction(async (db) => {
    const values = { ...data, published_at: data.published_at ?? new Date().toISOString(), author_id: req.user!.id };
    const cols = Object.keys(values) as (keyof typeof values)[];
    const a = await queryOne(
      `INSERT INTO announcements (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
      cols.map((c) => values[c]),
      db,
    );
    if (isImportant(a)) await notifyAnnouncement(a, db);
    return a;
  });
  res.status(201).json(row);
});

announcementsRouter.patch("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const id = idParam.parse(req.params.id);
  const data = updateSchema.parse(req.body);
  const cols = (Object.keys(data) as (keyof typeof data)[]).filter((c) => data[c] !== undefined);
  if (cols.length === 0) {
    const a = await queryOne(`${SELECT} WHERE a.id = $1`, [id]);
    if (!a) throw notFound("ANNOUNCEMENT_NOT_FOUND");
    res.json(a);
    return;
  }
  const a = await queryOne(
    `UPDATE announcements SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(", ")}, updated_at = NOW()
     WHERE id = $1 RETURNING id`,
    [id, ...cols.map((c) => data[c])],
  );
  if (!a) throw notFound("ANNOUNCEMENT_NOT_FOUND");
  res.json(await queryOne(`${SELECT} WHERE a.id = $1`, [id]));
});

announcementsRouter.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const id = idParam.parse(req.params.id);
  const deleted = await queryOne(`DELETE FROM announcements WHERE id = $1 RETURNING id`, [id]);
  if (!deleted) throw notFound("ANNOUNCEMENT_NOT_FOUND");
  res.status(204).end();
});
