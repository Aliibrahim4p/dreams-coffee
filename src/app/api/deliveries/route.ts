import { NextRequest, NextResponse } from "next/server";
import { DeliveryCreateSchema } from "@/types/delivery";
import { DeliveryService } from "@/services/delivery-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";
import { parseDateParam } from "@/lib/parse-date-param";
import { parseIdParam } from "@/lib/parse-id-param";
import { getManagerId } from "@/lib/get-manager-id";

export async function POST(req: NextRequest) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(DeliveryCreateSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const managerId = getManagerId(req);
    const delivery = await DeliveryService.createDelivery(validation.data, managerId);
    return NextResponse.json({ delivery }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(req: NextRequest) {
  const dateReceivedParam = req.nextUrl.searchParams.get("date_received");
  const supplierIdParam = req.nextUrl.searchParams.get("supplier_id");

  try {
    const deliveries = await DeliveryService.listDeliveries(
      dateReceivedParam ? parseDateParam(dateReceivedParam, "date_received") : undefined,
      supplierIdParam !== null ? parseIdParam(supplierIdParam, "supplier_id") : undefined,
    );
    return NextResponse.json(deliveries, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
