import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { MulterError } from "multer";
import { AppError } from "../lib/errors";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND" } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    const fields = err.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
    res.status(400).json({ error: { code: "VALIDATION_ERROR", details: fields } });
    return;
  }
  if (err instanceof MulterError) {
    res.status(400).json({ error: { code: "INVALID_FILE", details: err.code } });
    return;
  }
  // Malformed JSON body
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR" } });
    return;
  }
  const pgCode = (err as { code?: string })?.code;
  if (pgCode === "23503" || pgCode === "23514" || pgCode === "22P02" || pgCode === "22007") {
    // FK / check constraint / invalid input syntax — a client-side problem
    res.status(400).json({ error: { code: "VALIDATION_ERROR" } });
    return;
  }

  // Log the real error on the server; never leak internals or stack traces to the client.
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
}
