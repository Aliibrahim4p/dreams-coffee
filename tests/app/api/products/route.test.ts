jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/product-service");

import { NextRequest } from "next/server";
import { ProductService } from "@/services/product-service";
import BadRequestException from "@/exceptions/bad-request-exception";
import { POST } from "@/app/api/products/route";

const MockedProductService = ProductService as jest.Mocked<typeof ProductService>;

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/products", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const validBody = { category_id: 1, name: "Latte", type: "recipe_based", base_price: 50000 };

describe("POST /api/products", () => {
  it("returns 201 with the created product", async () => {
    MockedProductService.createProduct.mockResolvedValue({
      product_id: 1,
      category_id: 1,
      name: "Latte",
      type: "recipe_based",
      base_price: 50000,
      is_active: true,
    });

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.product.product_id).toBe(1);
  });

  it("returns 400 for a missing required field", async () => {
    const res = await POST(makeRequest({ name: "Latte" }));
    expect(res.status).toBe(400);
    expect(MockedProductService.createProduct).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/products", {
      method: "POST",
      body: "not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(MockedProductService.createProduct).not.toHaveBeenCalled();
  });

  it("returns 400 when category_id is invalid", async () => {
    MockedProductService.createProduct.mockRejectedValue(
      new BadRequestException("Invalid category_id"),
    );

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(400);
  });

  it("returns 500 on unexpected errors", async () => {
    MockedProductService.createProduct.mockRejectedValue(new Error("boom"));

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(500);
  });
});
