jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/product-service");

import { NextRequest } from "next/server";
import { ProductService } from "@/services/product-service";
import NotFoundException from "@/exceptions/not-found-exception";
import BadRequestException from "@/exceptions/bad-request-exception";
import { PATCH } from "@/app/api/products/[product_id]/recipe/[recipe_id]/route";

const MockedProductService = ProductService as jest.Mocked<typeof ProductService>;

function makeParams(product_id: string, recipe_id: string) {
  return { params: Promise.resolve({ product_id, recipe_id }) };
}

const validUpdateBody = { ingredients: [{ item_id: 5, quantity: 250, unit: "ml" }] };

// Admin auth for this route is enforced entirely by proxy.ts (X-Admin-Token, see
// tests/proxy.test.ts) — the handler itself no longer checks any admin credential.
function makePatchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/products/1/recipe/10", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("PATCH /api/products/[product_id]/recipe/[recipe_id]", () => {
  it("returns 200 with the updated recipe", async () => {
    MockedProductService.updateRecipe.mockResolvedValue({
      recipe_id: 10,
      product_id: 1,
      product_name: "Latte",
      modifier_id: 1,
      modifier_name: "Small",
      ingredients: [{ item_id: 5, item_name: "Milk", quantity: 250, unit: "ml" }],
    });

    const res = await PATCH(makePatchRequest(validUpdateBody), makeParams("1", "10"));

    expect(res.status).toBe(200);
    expect(MockedProductService.updateRecipe).toHaveBeenCalledWith(1, 10, validUpdateBody);
  });

  it("returns 400 when the body is empty, without calling the service", async () => {
    const res = await PATCH(makePatchRequest({}), makeParams("1", "10"));

    expect(res.status).toBe(400);
    expect(MockedProductService.updateRecipe).not.toHaveBeenCalled();
  });

  it("returns 400 when ingredients is present but empty", async () => {
    const res = await PATCH(makePatchRequest({ ingredients: [] }), makeParams("1", "10"));

    expect(res.status).toBe(400);
    expect(MockedProductService.updateRecipe).not.toHaveBeenCalled();
  });

  it("returns 404 when the recipe does not exist (or doesn't belong to this product)", async () => {
    MockedProductService.updateRecipe.mockRejectedValue(new NotFoundException("Recipe not found"));

    const res = await PATCH(makePatchRequest(validUpdateBody), makeParams("1", "10"));

    expect(res.status).toBe(404);
  });

  it("returns 400 when reassigning modifier_id breaks reseller/recipe_based consistency", async () => {
    MockedProductService.updateRecipe.mockRejectedValue(
      new BadRequestException("Reseller products cannot have a modifier_id"),
    );

    const res = await PATCH(makePatchRequest({ modifier_id: 2 }), makeParams("1", "10"));

    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-numeric recipe_id without calling the service", async () => {
    const res = await PATCH(makePatchRequest(validUpdateBody), makeParams("1", "abc"));

    expect(res.status).toBe(400);
    expect(MockedProductService.updateRecipe).not.toHaveBeenCalled();
  });

  it("accepts a modifier_id-only update with no ingredients", async () => {
    MockedProductService.updateRecipe.mockResolvedValue({
      recipe_id: 10,
      product_id: 1,
      product_name: "Latte",
      modifier_id: 2,
      modifier_name: "Medium",
      ingredients: [],
    });

    const res = await PATCH(makePatchRequest({ modifier_id: 2 }), makeParams("1", "10"));

    expect(res.status).toBe(200);
    expect(MockedProductService.updateRecipe).toHaveBeenCalledWith(1, 10, { modifier_id: 2 });
  });
});
