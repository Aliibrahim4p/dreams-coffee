import { NextRequest, NextResponse } from "next/server";
import { ProductUpdateSchema } from "@/types/product";
import { ProductService } from "@/services/product-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";
import { parseIdParam } from "@/lib/parse-id-param";

type RouteParams = { params: Promise<{ product_id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { product_id } = await params;
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(ProductUpdateSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const productId = parseIdParam(product_id, "product_id");
    const product = await ProductService.updateProduct(productId, validation.data);
    return NextResponse.json(product, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { product_id } = await params;

  try {
    const productId = parseIdParam(product_id, "product_id");
    await ProductService.deactivateProduct(productId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
