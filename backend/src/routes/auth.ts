import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { query, queryOne, transaction } from "../db";
import { requireAuth, signToken } from "../middleware/auth";
import { AppError } from "../lib/errors";
import { langSchema, optText } from "../lib/validation";
import { getUserProfile } from "../lib/users";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: { code: "TOO_MANY_REQUESTS" } });
  },
});

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8).max(128);

const registerSchema = z.object({
  email,
  password,
  full_name: z.string().trim().min(2).max(150),
  student_code: optText(50),
  group_name: optText(50),
  faculty: optText(150),
  phone: optText(30),
  language: langSchema.default("ru"),
});

const loginSchema = z.object({ email, password: z.string().min(1).max(128) });

// Used to keep login timing constant when the email does not exist.
const DUMMY_HASH = await Bun.password.hash("timing-safe-dummy-password");

authRouter.post("/register", authLimiter, async (req, res) => {
  const data = registerSchema.parse(req.body);

  const existing = await queryOne(`SELECT 1 FROM users WHERE email = $1`, [data.email]);
  if (existing) throw new AppError(409, "EMAIL_TAKEN");

  const passwordHash = await Bun.password.hash(data.password); // argon2id

  const user = await transaction(async (db) => {
    const u = await queryOne(
      `INSERT INTO users (email, password_hash, full_name, role, language)
       VALUES ($1, $2, $3, 'STUDENT', $4) RETURNING id, token_version`,
      [data.email, passwordHash, data.full_name, data.language],
      db,
    );
    await query(
      `INSERT INTO student_profiles (user_id, student_code, group_name, faculty, phone) VALUES ($1, $2, $3, $4, $5)`,
      [u.id, data.student_code, data.group_name, data.faculty, data.phone],
      db,
    );
    return u;
  }).catch((err) => {
    if (err?.code === "23505") throw new AppError(409, "EMAIL_TAKEN"); // concurrent sign-up race
    throw err;
  });

  res.status(201).json({ token: signToken(user.id, user.token_version), user: await getUserProfile(user.id) });
});

authRouter.post("/login", authLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await queryOne(
    `SELECT id, password_hash, is_blocked, token_version FROM users WHERE email = $1`,
    [email],
  );

  const valid = await Bun.password.verify(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) throw new AppError(401, "INVALID_CREDENTIALS");
  if (user.is_blocked) throw new AppError(403, "USER_BLOCKED");

  res.json({ token: signToken(user.id, user.token_version), user: await getUserProfile(user.id) });
});

/** Invalidates every token issued to this user so far. */
authRouter.post("/logout", requireAuth, async (req, res) => {
  await query(`UPDATE users SET token_version = token_version + 1 WHERE id = $1`, [req.user!.id]);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json(await getUserProfile(req.user!.id));
});
