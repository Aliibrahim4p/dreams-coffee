jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/product-service");

import { NextRequest } from "next/server";
import { ProductService } from "@/services/product-service";
import NotFoundException from "@/exceptions/not-found-exception";
import { GET } from "@/app/api/products/[product_id]/sizes/route";

const MockedProductService = ProductService as jest.Mocked<typeof ProductService>;

function makeParams(product_id: string) {
  return { params: Promise.resolve({ product_id }) };
}

describe("GET /api/products/[product_id]/sizes", () => {
  it("returns 200 with the resolved sizes", async () => {
    MockedProductService.getProductSizes.mockResolvedValue([
      {
        modifier_id: 1,
        modifier_name: "Large",
        price_adjustment: 5000,
        resolved_price: 55000,
        available: true,
      },
    ]);

    const req = new NextRequest("http://localhost/api/products/1/sizes");
    const res = await GET(req, makeParams("1"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(MockedProductService.getProductSizes).toHaveBeenCalledWith(1);
  });

  it("returns 404 when the product does not exist", async () => {
    MockedProductService.getProductSizes.mockRejectedValue(new NotFoundException("Product not found"));

    const req = new NextRequest("http://localhost/api/products/999/sizes");
    const res = await GET(req, makeParams("999"));

    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric product_id without calling the service", async () => {
    const req = new NextRequest("http://localhost/api/products/abc/sizes");
    const res = await GET(req, makeParams("abc"));

    expect(res.status).toBe(400);
    expect(MockedProductService.getProductSizes).not.toHaveBeenCalled();
  });
});
