import { NextRequest, NextResponse } from "next/server";
import { InventoryCountEntryCreateSchema } from "@/types/inventory-count-entry";
import { InventoryCountEntryService } from "@/services/inventory-count-entry-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";
import DuplicateCountEntryException from "@/exceptions/duplicate-count-entry-exception";
import { parseDateParam } from "@/lib/parse-date-param";
import { parseIdParam } from "@/lib/parse-id-param";
import { getManagerId } from "@/lib/get-manager-id";

export async function POST(req: NextRequest) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(InventoryCountEntryCreateSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const managerId = getManagerId(req);
    const entry = await InventoryCountEntryService.createEntry(validation.data, managerId);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateCountEntryException) {
      return NextResponse.json(
        { code: "CONFLICT", message: error.message, count_id: error.count_id },
        { status: 409 },
      );
    }
    return handleRouteError(error);
  }
}

export async function GET(req: NextRequest) {
  const entryDateParam = req.nextUrl.searchParams.get("entry_date");
  const itemIdParam = req.nextUrl.searchParams.get("item_id");

  try {
    const entries = await InventoryCountEntryService.listEntries(
      entryDateParam ? parseDateParam(entryDateParam, "entry_date") : undefined,
      itemIdParam !== null ? parseIdParam(itemIdParam, "item_id") : undefined,
    );
    return NextResponse.json(entries, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
