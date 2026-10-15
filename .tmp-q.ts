import { Client } from "pg";
import { readFileSync } from "fs";
const url = readFileSync("/private/tmp/claude-501/-Users-ivangonzalez/1e8d382a-7e6a-41a6-8e73-b74b89d8fd73/scratchpad/dburl.txt","utf8").trim();
(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const sql = process.argv[2];
  const r = await c.query(sql);
  console.log(JSON.stringify(r.rows, null, 1));
  await c.end();
})().catch(e => { console.error("ERROR", e.message); process.exit(1); });
