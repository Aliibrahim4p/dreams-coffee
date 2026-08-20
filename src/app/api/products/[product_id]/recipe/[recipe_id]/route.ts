import { NextRequest, NextResponse } from "next/server";
import { RecipeUpdateSchema } from "@/types/recipe";
import { ProductService } from "@/services/product-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";
import { parseIdParam } from "@/lib/parse-id-param";

type RouteParams = { params: Promise<{ product_id: string; recipe_id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { product_id, recipe_id } = await params;
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(RecipeUpdateSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const productId = parseIdParam(product_id, "product_id");
    const recipeId = parseIdParam(recipe_id, "recipe_id");
    const recipe = await ProductService.updateRecipe(productId, recipeId, validation.data);
    return NextResponse.json(recipe, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
