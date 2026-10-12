import { Router } from "express";
import { z } from "zod";
import { query, queryOne } from "../db";
import { requireAuth } from "../middleware/auth";
import { notFound } from "../lib/errors";
import { idParam, pagination } from "../lib/validation";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res) => {
  const q = z.object({ unread: z.enum(["true", "false"]).optional(), ...pagination }).parse(req.query);
  const userId = req.user!.id;
  const unreadOnly = q.unread === "true";
  const items = await query(
    `SELECT id, type, title_ky, title_ru, title_en, message_ky, message_ru, message_en, link, is_read, created_at
     FROM notifications WHERE user_id = $1 AND ($2::boolean = FALSE OR is_read = FALSE)
     ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`,
    [userId, unreadOnly, q.pageSize, (q.page - 1) * q.pageSize],
  );
  const counts = await queryOne(
    `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE NOT is_read) AS unread FROM notifications WHERE user_id = $1`,
    [userId],
  );
  res.json({ items, total: counts.total, unread: counts.unread, page: q.page, pageSize: q.pageSize });
});

notificationsRouter.get("/unread-count", async (req, res) => {
  const row = await queryOne(`SELECT COUNT(*) AS unread FROM notifications WHERE user_id = $1 AND NOT is_read`, [
    req.user!.id,
  ]);
  res.json({ unread: row.unread });
});

notificationsRouter.patch("/read-all", async (req, res) => {
  await query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND NOT is_read`, [req.user!.id]);
  res.status(204).end();
});

notificationsRouter.patch("/:id/read", async (req, res) => {
  const id = idParam.parse(req.params.id);
  // Scoped by user_id so nobody can touch someone else's notifications.
  const row = await queryOne(`UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id`, [
    id,
    req.user!.id,
  ]);
  if (!row) throw notFound();
  res.status(204).end();
});
