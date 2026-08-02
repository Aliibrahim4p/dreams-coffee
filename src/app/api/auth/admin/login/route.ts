import { NextRequest, NextResponse } from "next/server";
import { AdminLoginSchema } from "@/types/admin-login";
import { AdminAuthService } from "@/services/admin-auth-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";

export async function POST(req: NextRequest) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(AdminLoginSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const result = await AdminAuthService.login(validation.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
