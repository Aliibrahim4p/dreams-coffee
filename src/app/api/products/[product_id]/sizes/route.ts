import { NextRequest, NextResponse } from "next/server";
import { ProductService } from "@/services/product-service";
import { handleRouteError } from "@/lib/handle-route-error";
import { parseIdParam } from "@/lib/parse-id-param";

type RouteParams = { params: Promise<{ product_id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { product_id } = await params;

  try {
    const productId = parseIdParam(product_id, "product_id");
    const sizes = await ProductService.getProductSizes(productId);
    return NextResponse.json(sizes, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
