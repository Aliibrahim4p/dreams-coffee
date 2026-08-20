import { NextRequest, NextResponse } from "next/server";
import { SupplierUpdateSchema } from "@/types/supplier";
import { SupplierService } from "@/services/supplier-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";
import { parseIdParam } from "@/lib/parse-id-param";

type RouteParams = { params: Promise<{ supplier_id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { supplier_id } = await params;
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(SupplierUpdateSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const supplierId = parseIdParam(supplier_id, "supplier_id");
    const supplier = await SupplierService.updateSupplier(supplierId, validation.data);
    return NextResponse.json(supplier, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { supplier_id } = await params;

  try {
    const supplierId = parseIdParam(supplier_id, "supplier_id");
    await SupplierService.deactivateSupplier(supplierId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
