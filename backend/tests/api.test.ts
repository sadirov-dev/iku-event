/**
 * API integration tests. Run against a freshly seeded database:
 *   bun run db:reset && bun test
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { app } from "../src/app";
import { pool } from "../src/db";

let server: Server;
let base: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const addr = server.address();
  base = `http://localhost:${typeof addr === "object" && addr ? addr.port : 0}/api`;
});
afterAll(async () => {
  server.close();
  await pool.end();
});

async function api(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const login = async (email: string, password: string) =>
  (await api("POST", "/auth/login", { email, password })).body.token as string;

const regForm = {
  full_name: "Test Student",
  student_code: "T-1",
  group_name: "ПИ-22",
  email: "t@iku.kg",
};

let admin: string;
let student: string;
let organizer: string;
let fresh: string;

beforeAll(async () => {
  admin = await login("admin@iku.kg", "Admin123!");
  student = await login("student@iku.kg", "Student123!");
  organizer = await login("organizer@iku.kg", "Organizer123!");
  const email = `new${Date.now()}@iku.kg`;
  const res = await api("POST", "/auth/register", { email, password: "Password1!", full_name: "New Student" });
  fresh = res.body.token;
});

async function findEvent(titleEn: string, token?: string) {
  const res = await api("GET", `/events?search=${encodeURIComponent(titleEn)}&pageSize=50`, undefined, token);
  return res.body.items.find((e: any) => e.title_en === titleEn || e.title_ru === titleEn);
}

describe("auth", () => {
  test("rejects wrong password with a translatable code", async () => {
    const res = await api("POST", "/auth/login", { email: "admin@iku.kg", password: "nope" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  test("duplicate email is rejected", async () => {
    const res = await api("POST", "/auth/register", { email: "student@iku.kg", password: "Password1!", full_name: "X Y" });
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  test("never exposes the password hash", async () => {
    const res = await api("GET", "/auth/me", undefined, student);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("STUDENT");
    expect(JSON.stringify(res.body)).not.toContain("password");
  });

  test("logout invalidates the token", async () => {
    const t = await login("student5@iku.kg", "Student123!");
    expect((await api("POST", "/auth/logout", undefined, t)).status).toBe(204);
    expect((await api("GET", "/auth/me", undefined, t)).status).toBe(401);
  });
});

describe("events", () => {
  test("public list hides drafts and pending events", async () => {
    const res = await api("GET", "/events?pageSize=100");
    const statuses = new Set(res.body.items.map((e: any) => e.status));
    expect(statuses.has("DRAFT")).toBe(false);
    expect(statuses.has("PENDING")).toBe(false);
    const adminRes = await api("GET", "/events?pageSize=100", undefined, admin);
    expect(adminRes.body.total).toBeGreaterThan(res.body.total);
  });

  test("search, category and period filters", async () => {
    const res = await api("GET", "/events?search=hackathon");
    expect(res.body.items.length).toBe(1);
    const it = await api("GET", "/events?category=it&pageSize=50");
    expect(it.body.items.every((e: any) => e.category.slug === "it")).toBe(true);
    const today = await api("GET", "/events?period=today");
    expect(today.body.items.length).toBeGreaterThanOrEqual(1);
  });

  test("draft detail is 404 for public", async () => {
    const all = await api("GET", "/events?status=DRAFT", undefined, admin);
    const draft = all.body.items[0];
    expect((await api("GET", `/events/${draft.id}`)).status).toBe(404);
  });

  test("student cannot create events", async () => {
    const res = await api("POST", "/events", { title_ru: "X", date: "2030-01-01", start_time: "10:00", end_time: "11:00" }, student);
    expect(res.status).toBe(403);
  });

  test("organizer cannot publish or edit someone else's event", async () => {
    const created = await api(
      "POST", "/events",
      { title_en: "Org event", date: "2030-01-01", start_time: "10:00", end_time: "11:00", status: "PUBLISHED" },
      organizer,
    );
    expect(created.status).toBe(403);
    const adminEvent = await findEvent("Career Fair");
    const res = await api("PATCH", `/events/${adminEvent.id}`, { title_en: "Hacked" }, organizer);
    expect(res.status).toBe(403);
  });

  test("validates times and titles", async () => {
    const res = await api("POST", "/events", { date: "2030-01-01", start_time: "12:00", end_time: "11:00" }, admin);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("registration", () => {
  test("register, duplicate blocked, cancel, re-register", async () => {
    const event = await findEvent("Sport Day", fresh);
    expect(event.registration_state).toBe("OPEN");

    const first = await api("POST", `/events/${event.id}/register`, regForm, fresh);
    expect(first.status).toBe(201);
    expect(first.body.my_registration).toBe("CONFIRMED");

    const dup = await api("POST", `/events/${event.id}/register`, regForm, fresh);
    expect(dup.body.error.code).toBe("ALREADY_REGISTERED");

    const mine = await api("GET", "/my-events", undefined, fresh);
    expect(mine.body.items.some((e: any) => e.id === event.id)).toBe(true);

    const notifs = await api("GET", "/notifications", undefined, fresh);
    expect(notifs.body.items[0].type).toBe("REGISTRATION");

    expect((await api("DELETE", `/events/${event.id}/register`, undefined, fresh)).status).toBe(200);
    const again = await api("POST", `/events/${event.id}/register`, regForm, fresh);
    expect(again.status).toBe(201);
  });

  test("full event", async () => {
    const event = await findEvent("Photography Masterclass", fresh);
    expect(event.seats_left).toBe(0);
    const res = await api("POST", `/events/${event.id}/register`, regForm, fresh);
    expect(res.body.error.code).toBe("EVENT_FULL");
  });

  test("deadline passed", async () => {
    const event = await findEvent("Math Olympiad", fresh);
    const res = await api("POST", `/events/${event.id}/register`, regForm, fresh);
    expect(res.body.error.code).toBe("REGISTRATION_CLOSED");
  });

  test("cancelled event", async () => {
    const event = await findEvent("Football: IKU vs KTU", fresh);
    const res = await api("POST", `/events/${event.id}/register`, regForm, fresh);
    expect(res.body.error.code).toBe("EVENT_CANCELLED");
  });

  test("anonymous users must sign in", async () => {
    const event = await findEvent("Sport Day");
    const res = await api("POST", `/events/${event.id}/register`, regForm);
    expect(res.status).toBe(401);
  });

  test("cancelling an event notifies participants", async () => {
    const created = await api(
      "POST", "/events",
      { title_ru: "Тест", title_en: "Cancel test", date: "2030-05-01", start_time: "10:00", end_time: "11:00", status: "PUBLISHED" },
      admin,
    );
    await api("POST", `/events/${created.body.id}/register`, regForm, fresh);
    await api("PATCH", `/events/${created.body.id}`, { status: "CANCELLED" }, admin);
    const notifs = await api("GET", "/notifications", undefined, fresh);
    expect(notifs.body.items[0].type).toBe("EVENT_CANCELLED");
    expect(notifs.body.items[0].message_en).toContain("Cancel test");
    await api("DELETE", `/events/${created.body.id}`, undefined, admin);
  });
});

describe("admin & announcements", () => {
  test("admin API is closed to students", async () => {
    expect((await api("GET", "/admin/stats", undefined, student)).status).toBe(403);
    expect((await api("GET", "/admin/stats")).status).toBe(401);
    expect((await api("GET", "/admin/stats", undefined, admin)).status).toBe(200);
  });

  test("important announcements sort first; expired are hidden", async () => {
    const res = await api("GET", "/announcements");
    expect(res.body.items[0].is_pinned).toBe(true);
    const created = await api(
      "POST", "/announcements",
      { title_en: "Old news", expires_at: new Date(Date.now() - 1000).toISOString() },
      admin,
    );
    expect(created.status).toBe(201);
    const list = await api("GET", "/announcements?search=Old%20news");
    expect(list.body.items.length).toBe(0);
    await api("DELETE", `/announcements/${created.body.id}`, undefined, admin);
  });

  test("students cannot create announcements", async () => {
    expect((await api("POST", "/announcements", { title_ru: "x" }, student)).status).toBe(403);
  });

  test("blocked user loses access immediately", async () => {
    const users = await api("GET", "/admin/users?search=student4", undefined, admin);
    const target = users.body.items[0];
    const t = await login("student4@iku.kg", "Student123!");
    await api("PATCH", `/admin/users/${target.id}`, { is_blocked: true }, admin);
    expect((await api("GET", "/auth/me", undefined, t)).body.error.code).toBe("USER_BLOCKED");
    await api("PATCH", `/admin/users/${target.id}`, { is_blocked: false }, admin);
  });

  test("errors never leak internals", async () => {
    const res = await api("GET", "/events/abc");
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain("at ");
  });
});
