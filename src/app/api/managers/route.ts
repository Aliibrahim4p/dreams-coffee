import { NextRequest, NextResponse } from "next/server";
import { ManagerCreateSchema } from "@/types/manager";
import { ManagerService } from "@/services/manager-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";
import { parseBooleanParam } from "@/lib/parse-boolean-param";

export async function POST(req: NextRequest) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(ManagerCreateSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const manager = await ManagerService.createManager(validation.data);
    return NextResponse.json({ manager }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(req: NextRequest) {
  const includeInactive = parseBooleanParam(req.nextUrl.searchParams.get("include_inactive"));

  try {
    const managers = await ManagerService.listManagers(includeInactive);
    return NextResponse.json(managers, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
