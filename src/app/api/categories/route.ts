import { CategoryService } from "@/services/category-service";
import { CategoryValidationSchema } from "@/types/category";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";
import { parseBooleanParam } from "@/lib/parse-boolean-param";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(CategoryValidationSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const category = await CategoryService.createCategory(validation.data);
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(req: NextRequest) {
  const includeProducts = req.nextUrl.searchParams.get("include") === "products";
  const includeInactive = parseBooleanParam(req.nextUrl.searchParams.get("include_inactive"));

  try {
    const categories = await CategoryService.listCategories(includeProducts, includeInactive);
    return NextResponse.json(categories, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
