import { NextRequest, NextResponse } from "next/server";
import { InventoryItemService } from "@/services/inventory-item-service";
import { handleRouteError } from "@/lib/handle-route-error";
import { parseIdParam } from "@/lib/parse-id-param";

type RouteParams = { params: Promise<{ item_id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { item_id } = await params;

  try {
    const itemId = parseIdParam(item_id, "item_id");
    const configs = await InventoryItemService.getPackConfigurations(itemId);
    return NextResponse.json(configs, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
