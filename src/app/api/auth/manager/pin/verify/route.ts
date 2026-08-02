import { NextRequest, NextResponse } from "next/server";
import { PanelPinVerifySchema } from "@/types/panel-pin";
import { PanelAuthService } from "@/services/panel-auth-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";

export async function POST(req: NextRequest) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(PanelPinVerifySchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const result = await PanelAuthService.verifyPin(validation.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
