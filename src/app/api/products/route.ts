import { NextRequest, NextResponse } from "next/server";
import { ProductCreateSchema } from "@/types/product";
import { ProductService } from "@/services/product-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";

export async function POST(req: NextRequest) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(ProductCreateSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const product = await ProductService.createProduct(validation.data);
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
