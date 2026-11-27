import { pool } from "./index";
import { config } from "../config";

const reset = process.argv.includes("--reset");

if (reset) {
  if (config.isProduction)
    throw new Error("Refusing to reset the database in production");
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  console.log("Database reset");
}

const schema = await Bun.file(new URL("./schema.sql", import.meta.url)).text();
await pool.query(schema);
await pool.query(`
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_language_check;
  ALTER TABLE users ADD CONSTRAINT users_language_check
    CHECK (language IN ('ky', 'ru', 'en', 'ar'));
`);
console.log("Schema applied");
await pool.end();
