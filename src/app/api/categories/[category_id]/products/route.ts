import { NextRequest, NextResponse } from "next/server";
import { ProductService } from "@/services/product-service";
import { handleRouteError } from "@/lib/handle-route-error";
import { parseIdParam } from "@/lib/parse-id-param";
import { parseBooleanParam } from "@/lib/parse-boolean-param";

type RouteParams = { params: Promise<{ category_id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { category_id } = await params;
  const includeInactive = parseBooleanParam(req.nextUrl.searchParams.get("include_inactive"));

  try {
    const categoryId = parseIdParam(category_id, "category_id");
    const products = await ProductService.listCategoryProducts(categoryId, includeInactive);
    return NextResponse.json(products, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
