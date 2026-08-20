import { NextRequest, NextResponse } from "next/server";
import { RecipeCreateSchema } from "@/types/recipe";
import { ProductService } from "@/services/product-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";
import { parseIdParam } from "@/lib/parse-id-param";

type RouteParams = { params: Promise<{ product_id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { product_id } = await params;
  const modifierIdParam = req.nextUrl.searchParams.get("modifier_id");

  try {
    const productId = parseIdParam(product_id, "product_id");
    const modifierId =
      modifierIdParam !== null ? parseIdParam(modifierIdParam, "modifier_id") : undefined;
    const recipe = await ProductService.getProductRecipe(productId, modifierId);
    return NextResponse.json(recipe, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { product_id } = await params;
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(RecipeCreateSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const productId = parseIdParam(product_id, "product_id");
    const recipe = await ProductService.createRecipe(productId, validation.data);
    return NextResponse.json({ recipe }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
