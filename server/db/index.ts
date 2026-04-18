import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";
import { type Logger } from "drizzle-orm";
import * as schema from "./schema";

class CustLogger implements Logger {
  logQuery(query: string, params: unknown[]): void {
    console.log(`\x1b[34mQUERY\x1b[0m: ${query}`);
    if (params.length) {
      console.log(`\x1b[34mPARAMS\x1b[0m: ${params.length}`);

      params.forEach((p) => console.log("    ", p));
    }
  }
}

const logger = new CustLogger();

export const db = drizzle(process.env.DB_FILE_NAME!, {
  logger,
  schema,
});
