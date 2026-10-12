import path from "node:path";

const env = process.env;
const isProduction = env.NODE_ENV === "production";

function required(name: string, devFallback?: string): string {
  const value = env[name];
  if (value) return value;
  if (!isProduction && devFallback !== undefined) return devFallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

export const config = {
  isProduction,
  port: Number(env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: env.JWT_EXPIRES_IN ?? "7d",
  corsOrigins: (env.CORS_ORIGIN ?? "http://localhost:5173").split(",").map((s) => s.trim()),
  timezone: env.APP_TIMEZONE ?? "Asia/Bishkek",
  uploadDir: path.resolve(env.UPLOAD_DIR ?? "uploads"),
  /** Built frontend (frontend/dist). When set, the API also serves the site — one container, one domain. */
  staticDir: env.STATIC_DIR ? path.resolve(env.STATIC_DIR) : null,
};

if (isProduction && config.jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production");
}
