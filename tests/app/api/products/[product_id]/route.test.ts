jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/product-service");

import { NextRequest } from "next/server";
import { ProductService } from "@/services/product-service";
import NotFoundException from "@/exceptions/not-found-exception";
import { PATCH, DELETE } from "@/app/api/products/[product_id]/route";

const MockedProductService = ProductService as jest.Mocked<typeof ProductService>;

function makeParams(product_id: string) {
  return { params: Promise.resolve({ product_id }) };
}

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/products/1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("PATCH /api/products/[product_id]", () => {
  it("returns 200 with the updated product", async () => {
    MockedProductService.updateProduct.mockResolvedValue({
      product_id: 1,
      category_id: 1,
      name: "New Name",
      type: "reseller",
      base_price: 1000,
      is_active: true,
    });

    const res = await PATCH(makeRequest({ name: "New Name" }), makeParams("1"));

    expect(res.status).toBe(200);
    expect(MockedProductService.updateProduct).toHaveBeenCalledWith(1, { name: "New Name" });
    await expect(res.json()).resolves.toEqual({
      product_id: 1,
      category_id: 1,
      name: "New Name",
      type: "reseller",
      base_price: 1000,
      is_active: true,
    });
  });

  it("returns 400 when body has no fields", async () => {
    const res = await PATCH(makeRequest({}), makeParams("1"));
    expect(res.status).toBe(400);
    expect(MockedProductService.updateProduct).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toEqual({ error: "At least one field is required" });
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/products/1", {
      method: "PATCH",
      body: "not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await PATCH(req, makeParams("1"));

    expect(res.status).toBe(400);
    expect(MockedProductService.updateProduct).not.toHaveBeenCalled();
  });

  it("returns 404 when the product does not exist", async () => {
    MockedProductService.updateProduct.mockRejectedValue(new NotFoundException("Product not found"));

    const res = await PATCH(makeRequest({ name: "New Name" }), makeParams("999"));

    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric product_id without calling the service", async () => {
    const res = await PATCH(makeRequest({ name: "New Name" }), makeParams("abc"));

    expect(res.status).toBe(400);
    expect(MockedProductService.updateProduct).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/products/[product_id]", () => {
  it("returns 204 on successful deactivation", async () => {
    MockedProductService.deactivateProduct.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/products/1", { method: "DELETE" });
    const res = await DELETE(req, makeParams("1"));

    expect(res.status).toBe(204);
    expect(MockedProductService.deactivateProduct).toHaveBeenCalledWith(1);
  });

  it("returns 404 when the product does not exist", async () => {
    MockedProductService.deactivateProduct.mockRejectedValue(new NotFoundException("Product not found"));

    const req = new NextRequest("http://localhost/api/products/999", { method: "DELETE" });
    const res = await DELETE(req, makeParams("999"));

    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric product_id without calling the service", async () => {
    const req = new NextRequest("http://localhost/api/products/abc", { method: "DELETE" });
    const res = await DELETE(req, makeParams("abc"));

    expect(res.status).toBe(400);
    expect(MockedProductService.deactivateProduct).not.toHaveBeenCalled();
  });
});
