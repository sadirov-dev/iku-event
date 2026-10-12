import { Router } from "express";
import { z } from "zod";
import { query, transaction } from "../db";
import { requireAuth } from "../middleware/auth";
import { langSchema, optText, uploadPath } from "../lib/validation";
import { getUserProfile } from "../lib/users";

export const profileRouter = Router();
profileRouter.use(requireAuth);

const updateSchema = z.object({
  full_name: z.string().trim().min(2).max(150).optional(),
  language: langSchema.optional(),
  avatar: uploadPath.optional(),
  student_code: optText(50).optional(),
  group_name: optText(50).optional(),
  faculty: optText(150).optional(),
  phone: optText(30).optional(),
});

profileRouter.patch("/", async (req, res) => {
  const data = updateSchema.parse(req.body);
  const userId = req.user!.id;

  await transaction(async (db) => {
    await query(
      `UPDATE users SET
         full_name = COALESCE($2, full_name),
         language  = COALESCE($3, language),
         avatar    = CASE WHEN $4::boolean THEN $5 ELSE avatar END,
         updated_at = NOW()
       WHERE id = $1`,
      [userId, data.full_name ?? null, data.language ?? null, data.avatar !== undefined, data.avatar ?? null],
      db,
    );

    const profileFields = ["student_code", "group_name", "faculty", "phone"] as const;
    const provided = profileFields.filter((f) => data[f] !== undefined);
    if (provided.length > 0) {
      await query(
        `INSERT INTO student_profiles (user_id, ${provided.join(", ")})
         VALUES ($1, ${provided.map((_, i) => `$${i + 2}`).join(", ")})
         ON CONFLICT (user_id) DO UPDATE SET ${provided.map((f) => `${f} = EXCLUDED.${f}`).join(", ")}`,
        [userId, ...provided.map((f) => data[f])],
        db,
      );
    }
  });

  res.json(await getUserProfile(userId));
});
