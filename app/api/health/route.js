import { sql } from "drizzle-orm";

import { jsonResponse } from "../../../api/security.mjs";
import { withDatabase } from "../../../db/connection.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await withDatabase((db) => db.execute(sql`select 1 as healthy`));
    return jsonResponse({
      status: "ok",
      service: "release-truth-gate",
    });
  } catch {
    return jsonResponse(
      {
        status: "unavailable",
        service: "release-truth-gate",
      },
      { status: 503 },
    );
  }
}
