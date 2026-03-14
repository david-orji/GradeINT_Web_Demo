import { db } from "./server/db";
import { exams } from "./shared/schema";

async function run() {
  const result = await db.select().from(exams);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

run().catch(console.error);
