jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/product-service");

import { NextRequest } from "next/server";
import { ProductService } from "@/services/product-service";
import NotFoundException from "@/exceptions/not-found-exception";
import { GET, POST } from "@/app/api/products/[product_id]/recipe/route";

const MockedProductService = ProductService as jest.Mocked<typeof ProductService>;

function makeParams(product_id: string) {
  return { params: Promise.resolve({ product_id }) };
}

const validRecipeBody = {
  modifier_id: 1,
  ingredients: [{ item_id: 5, quantity: 200, unit: "ml" }],
};

// Admin auth for this route is enforced entirely by proxy.ts (X-Admin-Token, see
// tests/proxy.test.ts) — the handler itself no longer checks any admin credential.
function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/products/1/recipe", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("GET /api/products/[product_id]/recipe", () => {
  it("returns 200 with the resolved recipe", async () => {
    MockedProductService.getProductRecipe.mockResolvedValue([
      {
        recipe_id: 1,
        product_id: 1,
        product_name: "Latte",
        modifier_id: null,
        modifier_name: null,
        ingredients: [],
      },
    ]);

    const req = new NextRequest("http://localhost/api/products/1/recipe");
    const res = await GET(req, makeParams("1"));

    expect(res.status).toBe(200);
    expect(MockedProductService.getProductRecipe).toHaveBeenCalledWith(1, undefined);
  });

  it("passes modifier_id through from the query string", async () => {
    MockedProductService.getProductRecipe.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/products/1/recipe?modifier_id=3");
    await GET(req, makeParams("1"));

    expect(MockedProductService.getProductRecipe).toHaveBeenCalledWith(1, 3);
  });

  it("returns 404 when no recipe is seeded", async () => {
    MockedProductService.getProductRecipe.mockRejectedValue(
      new NotFoundException("No recipe seeded for this product"),
    );

    const req = new NextRequest("http://localhost/api/products/1/recipe");
    const res = await GET(req, makeParams("1"));

    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric product_id without calling the service", async () => {
    const req = new NextRequest("http://localhost/api/products/abc/recipe");
    const res = await GET(req, makeParams("abc"));

    expect(res.status).toBe(400);
    expect(MockedProductService.getProductRecipe).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-numeric modifier_id query param", async () => {
    const req = new NextRequest("http://localhost/api/products/1/recipe?modifier_id=abc");
    const res = await GET(req, makeParams("1"));

    expect(res.status).toBe(400);
    expect(MockedProductService.getProductRecipe).not.toHaveBeenCalled();
  });
});

describe("POST /api/products/[product_id]/recipe", () => {
  it("returns 201 with the created recipe", async () => {
    MockedProductService.createRecipe.mockResolvedValue({
      recipe_id: 1,
      product_id: 1,
      product_name: "Latte",
      modifier_id: 1,
      modifier_name: "Small",
      ingredients: [{ item_id: 5, item_name: "Milk", quantity: 200, unit: "ml" }],
    });

    const res = await POST(makePostRequest(validRecipeBody), makeParams("1"));

    expect(res.status).toBe(201);
    expect(MockedProductService.createRecipe).toHaveBeenCalledWith(1, validRecipeBody);
  });

  it("returns 400 when ingredients is empty, without calling the service", async () => {
    const res = await POST(makePostRequest({ ...validRecipeBody, ingredients: [] }), makeParams("1"));

    expect(res.status).toBe(400);
    expect(MockedProductService.createRecipe).not.toHaveBeenCalled();
  });

  it("returns 404 when the product does not exist", async () => {
    MockedProductService.createRecipe.mockRejectedValue(new NotFoundException("Product not found"));

    const res = await POST(makePostRequest(validRecipeBody), makeParams("1"));

    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric product_id without calling the service", async () => {
    const res = await POST(makePostRequest(validRecipeBody), makeParams("abc"));

    expect(res.status).toBe(400);
    expect(MockedProductService.createRecipe).not.toHaveBeenCalled();
  });
});
