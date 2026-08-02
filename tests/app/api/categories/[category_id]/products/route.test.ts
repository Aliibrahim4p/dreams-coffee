jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/product-service");

import { NextRequest } from "next/server";
import { ProductService } from "@/services/product-service";
import NotFoundException from "@/exceptions/not-found-exception";
import { GET } from "@/app/api/categories/[category_id]/products/route";

const MockedProductService = ProductService as jest.Mocked<typeof ProductService>;

function makeParams(category_id: string) {
  return { params: Promise.resolve({ category_id }) };
}

describe("GET /api/categories/[category_id]/products", () => {
  it("returns 200 with the category's products", async () => {
    MockedProductService.listCategoryProducts.mockResolvedValue([
      { product_id: 1, category_id: 1, name: "Latte", type: "reseller", base_price: 1000, is_active: true },
    ]);

    const req = new NextRequest("http://localhost/api/categories/1/products");
    const res = await GET(req, makeParams("1"));

    expect(res.status).toBe(200);
    expect(MockedProductService.listCategoryProducts).toHaveBeenCalledWith(1, false);
  });

  it("returns 404 when the category does not exist", async () => {
    MockedProductService.listCategoryProducts.mockRejectedValue(
      new NotFoundException("Category not found"),
    );

    const req = new NextRequest("http://localhost/api/categories/999/products");
    const res = await GET(req, makeParams("999"));

    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric category_id without calling the service", async () => {
    const req = new NextRequest("http://localhost/api/categories/abc/products");
    const res = await GET(req, makeParams("abc"));

    expect(res.status).toBe(400);
    expect(MockedProductService.listCategoryProducts).not.toHaveBeenCalled();
  });
});
