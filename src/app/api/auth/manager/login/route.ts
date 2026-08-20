import { NextRequest, NextResponse } from "next/server";
import { ManagerLoginSchema } from "@/types/manager-login";
import { ManagerAuthService } from "@/services/manager-auth-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";

export async function POST(req: NextRequest) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(ManagerLoginSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const result = await ManagerAuthService.login(validation.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
