import { NextRequest, NextResponse } from "next/server";
import { SupplierCreateSchema } from "@/types/supplier";
import { SupplierService } from "@/services/supplier-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";
import { parseBooleanParam } from "@/lib/parse-boolean-param";

export async function GET(req: NextRequest) {
  const includeInactive = parseBooleanParam(req.nextUrl.searchParams.get("include_inactive"));

  try {
    const suppliers = await SupplierService.listSuppliers(includeInactive);
    return NextResponse.json(suppliers, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(SupplierCreateSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const supplier = await SupplierService.createSupplier(validation.data);
    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
