import { NextRequest, NextResponse } from "next/server";
import { CategoryUpdateSchema } from "@/types/category";
import { CategoryService } from "@/services/category-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";
import { parseIdParam } from "@/lib/parse-id-param";

type RouteParams = { params: Promise<{ category_id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { category_id } = await params;
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(CategoryUpdateSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const categoryId = parseIdParam(category_id, "category_id");
    const category = await CategoryService.updateCategory(categoryId, validation.data);
    return NextResponse.json(category, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { category_id } = await params;

  try {
    const categoryId = parseIdParam(category_id, "category_id");
    await CategoryService.deactivateCategory(categoryId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
