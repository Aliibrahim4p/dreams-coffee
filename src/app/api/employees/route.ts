import { NextRequest, NextResponse } from "next/server";
import { EmployeeCreateSchema } from "@/types/employee";
import { EmployeeService } from "@/services/employee-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";
import { parseBooleanParam } from "@/lib/parse-boolean-param";

export async function POST(req: NextRequest) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(EmployeeCreateSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const employee = await EmployeeService.createEmployee(validation.data);
    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(req: NextRequest) {
  const includeInactive = parseBooleanParam(req.nextUrl.searchParams.get("include_inactive"));

  try {
    const employees = await EmployeeService.listEmployees(includeInactive);
    return NextResponse.json(employees, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
