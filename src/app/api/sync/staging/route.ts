import { NextRequest, NextResponse } from "next/server";
import { StagingRequestSchema } from "@/types/staging";
import { StagingService } from "@/services/staging-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";

export async function POST(req: NextRequest) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(StagingRequestSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const results = await StagingService.stageRecords(validation.data.records);
    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
