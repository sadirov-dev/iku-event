import { Router } from "express";
import { z } from "zod";
import { query, queryOne } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { notFound } from "../lib/errors";
import { idParam, optText } from "../lib/validation";

/** Generic CRUD for small admin-managed lookup tables (categories, venues). */
function lookupRouter(table: "categories" | "venues", schema: z.ZodObject, orderBy: string) {
  const router = Router();
  const admin = [requireAuth, requireRole("ADMIN")];

  router.get("/", async (_req, res) => {
    const extra =
      table === "categories"
        ? `, (SELECT COUNT(*) FROM events e WHERE e.category_id = t.id AND e.status = 'PUBLISHED'
                AND (e.date + e.end_time) >= LOCALTIMESTAMP) AS upcoming_count`
        : "";
    res.json(await query(`SELECT t.*${extra} FROM ${table} t ORDER BY ${orderBy}`));
  });

  router.post("/", ...admin, async (req, res) => {
    const data = schema.parse(req.body) as Record<string, unknown>;
    const cols = Object.keys(data);
    const row = await queryOne(
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
      cols.map((c) => data[c]),
    );
    res.status(201).json(row);
  });

  router.patch("/:id", ...admin, async (req, res) => {
    const id = idParam.parse(req.params.id);
    const data = schema.partial().parse(req.body) as Record<string, unknown>;
    const cols = Object.keys(data).filter((c) => data[c] !== undefined);
    if (cols.length === 0) throw notFound();
    const row = await queryOne(
      `UPDATE ${table} SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(", ")} WHERE id = $1 RETURNING *`,
      [id, ...cols.map((c) => data[c])],
    );
    if (!row) throw notFound();
    res.json(row);
  });

  router.delete("/:id", ...admin, async (req, res) => {
    const id = idParam.parse(req.params.id);
    const row = await queryOne(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [id]);
    if (!row) throw notFound();
    res.status(204).end();
  });

  return router;
}

export const categoriesRouter = lookupRouter(
  "categories",
  z.object({
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,40}$/),
    name_ky: optText(100),
    name_ru: optText(100),
    name_en: optText(100),
    icon: optText(10),
    color: optText(20),
    sort_order: z.number().int().default(0),
  }),
  "t.sort_order, t.id",
);

export const venuesRouter = lookupRouter(
  "venues",
  z.object({
    name_ky: optText(150),
    name_ru: optText(150),
    name_en: optText(150),
    building: optText(100),
    floor: optText(20),
    room: optText(20),
    capacity: z.number().int().positive().nullish().transform((v) => v ?? null),
  }),
  "t.id",
);
