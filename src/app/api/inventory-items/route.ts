import { NextRequest, NextResponse } from "next/server";
import { InventoryItemCreateSchema } from "@/types/inventory-item";
import { InventoryItemService } from "@/services/inventory-item-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";
import { parseBooleanParam } from "@/lib/parse-boolean-param";
import BadRequestException from "@/exceptions/bad-request-exception";

const VALID_COUNT_FREQUENCIES = ["daily", "monthly"];

export async function POST(req: NextRequest) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(InventoryItemCreateSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const item = await InventoryItemService.createInventoryItem(validation.data);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(req: NextRequest) {
  const countFrequency = req.nextUrl.searchParams.get("count_frequency") ?? undefined;
  const negativeOnly = parseBooleanParam(req.nextUrl.searchParams.get("negative_only"));
  const includeInactive = parseBooleanParam(req.nextUrl.searchParams.get("include_inactive"));

  try {
    if (countFrequency !== undefined && !VALID_COUNT_FREQUENCIES.includes(countFrequency)) {
      throw new BadRequestException("Invalid count_frequency");
    }
    const items = await InventoryItemService.listInventoryItems(countFrequency, negativeOnly, includeInactive);
    return NextResponse.json(items, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
