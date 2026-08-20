import { NextRequest, NextResponse } from "next/server";
import { EmployeeUpdateSchema } from "@/types/employee";
import { EmployeeService } from "@/services/employee-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";
import { parseIdParam } from "@/lib/parse-id-param";

type RouteParams = { params: Promise<{ pos_id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { pos_id } = await params;

  try {
    const posId = parseIdParam(pos_id, "pos_id");
    const employee = await EmployeeService.getEmployee(posId);
    return NextResponse.json(employee, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { pos_id } = await params;
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(EmployeeUpdateSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const posId = parseIdParam(pos_id, "pos_id");
    const employee = await EmployeeService.updateEmployee(posId, validation.data);
    return NextResponse.json(employee, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { pos_id } = await params;

  try {
    const posId = parseIdParam(pos_id, "pos_id");
    await EmployeeService.deactivateEmployee(posId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
