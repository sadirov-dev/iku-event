import { z } from "zod";

export const langSchema = z.enum(["ky", "ru", "en"]);

/** Trimmed optional text: empty strings become null so "missing translation" is uniform. */
export const optText = (max = 10_000) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const idParam = z.coerce.number().int().positive();

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
};

/** Upload URLs must point at our own /uploads directory — prevents injecting arbitrary links/scripts. */
export const uploadPath = z
  .string()
  .regex(/^\/uploads\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|gif|pdf)$/)
  .nullish()
  .transform((v) => v ?? null);

export const LOCALES = ["ky", "ru", "en"] as const;

/** At least one language variant of `field` must be filled in. */
export function hasSomeTranslation(field: string) {
  return (obj: Record<string, unknown>) => LOCALES.some((l) => obj[`${field}_${l}`]);
}
