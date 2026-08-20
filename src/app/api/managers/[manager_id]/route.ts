import { NextRequest, NextResponse } from "next/server";
import { ManagerUpdateSchema } from "@/types/manager";
import { ManagerService } from "@/services/manager-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";
import { parseIdParam } from "@/lib/parse-id-param";

type RouteParams = { params: Promise<{ manager_id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { manager_id } = await params;

  try {
    const managerId = parseIdParam(manager_id, "manager_id");
    const manager = await ManagerService.getManager(managerId);
    return NextResponse.json(manager, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { manager_id } = await params;
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(ManagerUpdateSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const managerId = parseIdParam(manager_id, "manager_id");
    const manager = await ManagerService.updateManager(managerId, validation.data);
    return NextResponse.json(manager, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { manager_id } = await params;

  try {
    const managerId = parseIdParam(manager_id, "manager_id");
    await ManagerService.deactivateManager(managerId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
