import { NextRequest, NextResponse } from "next/server";
import { OpenShiftSessionSchema } from "@/types/shift-session";
import { ShiftSessionService } from "@/services/shift-session-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";

export async function POST(req: NextRequest) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(OpenShiftSessionSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const session = await ShiftSessionService.openSession(validation.data);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
