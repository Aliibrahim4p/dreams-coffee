import { NextRequest, NextResponse } from "next/server";
import { SyncRecordsRequestSchema } from "@/types/sync";
import { SyncService } from "@/services/sync-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";

export async function POST(req: NextRequest) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(SyncRecordsRequestSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const results = await SyncService.syncOrderRecords(validation.data.records);
    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
