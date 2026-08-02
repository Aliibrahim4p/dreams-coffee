import { NextRequest, NextResponse } from "next/server";
import { InventoryCountEntryUpdateSchema } from "@/types/inventory-count-entry";
import { InventoryCountEntryService } from "@/services/inventory-count-entry-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";

type RouteParams = { params: Promise<{ count_id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { count_id } = await params;

  try {
    const entry = await InventoryCountEntryService.getEntry(count_id);
    return NextResponse.json(entry, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { count_id } = await params;
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(InventoryCountEntryUpdateSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const entry = await InventoryCountEntryService.updateEntry(count_id, validation.data);
    return NextResponse.json(entry, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
