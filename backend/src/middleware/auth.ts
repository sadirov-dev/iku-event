import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { queryOne } from "../db";
import { AppError } from "../lib/errors";

export type Role = "STUDENT" | "ORGANIZER" | "ADMIN";
export type Lang = "ky" | "ru" | "en";

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  language: Lang;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface TokenPayload {
  sub: string;
  ver: number;
}

export function signToken(userId: number, tokenVersion: number): string {
  return jwt.sign({ ver: tokenVersion }, config.jwtSecret, {
    subject: String(userId),
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
    algorithm: "HS256",
  });
}

async function resolveUser(req: Request): Promise<AuthUser | undefined> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;

  let payload: TokenPayload;
  try {
    payload = jwt.verify(header.slice(7), config.jwtSecret, { algorithms: ["HS256"] }) as TokenPayload;
  } catch {
    throw new AppError(401, "UNAUTHORIZED");
  }

  // Looking the user up on every request lets blocking, role changes and logout
  // (token_version bump) take effect immediately instead of when the JWT expires.
  const user = await queryOne(
    `SELECT id, email, full_name, role, language, is_blocked, token_version FROM users WHERE id = $1`,
    [Number(payload.sub)],
  );
  if (!user || user.token_version !== payload.ver) throw new AppError(401, "UNAUTHORIZED");
  if (user.is_blocked) throw new AppError(403, "USER_BLOCKED");

  return { id: user.id, email: user.email, full_name: user.full_name, role: user.role, language: user.language };
}

/** Attaches req.user when a valid token is present; anonymous requests pass through. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = await resolveUser(req);
  next();
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = await resolveUser(req);
  if (!req.user) throw new AppError(401, "UNAUTHORIZED");
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED");
    if (!roles.includes(req.user.role)) throw new AppError(403, "FORBIDDEN");
    next();
  };
}
