import { Router } from "express";
import { z } from "zod";
import { query } from "../db";
import { requireAuth } from "../middleware/auth";
import { eventSelect, serializeEvent, type EventRow } from "../lib/events";

export const myEventsRouter = Router();

const TAB_SQL = {
  // Active registration for an event that hasn't finished and isn't cancelled.
  upcoming: `r.status IN ('CONFIRMED', 'PENDING') AND e.status NOT IN ('CANCELLED', 'COMPLETED')
             AND (e.date + e.end_time) >= LOCALTIMESTAMP`,
  past: `r.status = 'CONFIRMED' AND e.status <> 'CANCELLED'
         AND (e.status = 'COMPLETED' OR (e.date + e.end_time) < LOCALTIMESTAMP)`,
  // Either the event itself was cancelled, or the student cancelled their registration.
  cancelled: `(e.status = 'CANCELLED' OR r.status = 'CANCELLED')`,
};

const ORDER = { upcoming: "e.date ASC, e.start_time ASC", past: "e.date DESC, e.start_time DESC", cancelled: "e.date DESC" };

myEventsRouter.get("/", requireAuth, async (req, res) => {
  const tab = z.enum(["upcoming", "past", "cancelled"]).default("upcoming").parse(req.query.tab);
  const rows = await query<EventRow & { attended: boolean }>(
    `${eventSelect()}
     JOIN registrations r ON r.event_id = e.id AND r.student_id = $1
     WHERE ${TAB_SQL[tab]}
     ORDER BY ${ORDER[tab]}`,
    [req.user!.id],
  );
  const counts = await query<{ tab: string; n: number }>(
    `SELECT t.tab, COUNT(*) AS n FROM registrations r JOIN events e ON e.id = r.event_id,
       LATERAL (VALUES
         ('upcoming', ${TAB_SQL.upcoming}),
         ('past', ${TAB_SQL.past}),
         ('cancelled', ${TAB_SQL.cancelled})) AS t(tab, matches)
     WHERE r.student_id = $1 AND t.matches GROUP BY t.tab`,
    [req.user!.id],
  );
  res.json({
    items: rows.map(serializeEvent),
    counts: Object.fromEntries(["upcoming", "past", "cancelled"].map((t) => [t, counts.find((c) => c.tab === t)?.n ?? 0])),
  });
});
