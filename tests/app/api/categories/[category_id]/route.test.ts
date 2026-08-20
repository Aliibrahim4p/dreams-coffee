jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/category-service");

import { NextRequest } from "next/server";
import { CategoryService } from "@/services/category-service";
import NotFoundException from "@/exceptions/not-found-exception";
import UniqueException from "@/exceptions/unique-exception";
import { PATCH, DELETE } from "@/app/api/categories/[category_id]/route";

const MockedCategoryService = CategoryService as jest.Mocked<typeof CategoryService>;

function makeParams(category_id: string) {
  return { params: Promise.resolve({ category_id }) };
}

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/categories/1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("PATCH /api/categories/[category_id]", () => {
  it("returns 200 with the renamed category", async () => {
    MockedCategoryService.updateCategory.mockResolvedValue({
      category_id: 1,
      name: "New Name",
      is_active: true,
    });

    const res = await PATCH(makeRequest({ name: "New Name" }), makeParams("1"));

    expect(res.status).toBe(200);
    expect(MockedCategoryService.updateCategory).toHaveBeenCalledWith(1, { name: "New Name" });
  });

  it("returns 400 when name is missing", async () => {
    const res = await PATCH(makeRequest({}), makeParams("1"));
    expect(res.status).toBe(400);
    expect(MockedCategoryService.updateCategory).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/categories/1", {
      method: "PATCH",
      body: "not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await PATCH(req, makeParams("1"));

    expect(res.status).toBe(400);
    expect(MockedCategoryService.updateCategory).not.toHaveBeenCalled();
  });

  it("returns 404 when the category does not exist", async () => {
    MockedCategoryService.updateCategory.mockRejectedValue(new NotFoundException("Category not found"));

    const res = await PATCH(makeRequest({ name: "New Name" }), makeParams("999"));

    expect(res.status).toBe(404);
  });

  it("returns 409 when the new name is taken", async () => {
    MockedCategoryService.updateCategory.mockRejectedValue(
      new UniqueException("Category name already taken"),
    );

    const res = await PATCH(makeRequest({ name: "Taken" }), makeParams("1"));

    expect(res.status).toBe(409);
  });

  it("returns 400 for a non-numeric category_id without calling the service", async () => {
    const res = await PATCH(makeRequest({ name: "New Name" }), makeParams("abc"));

    expect(res.status).toBe(400);
    expect(MockedCategoryService.updateCategory).not.toHaveBeenCalled();
  });

  it("returns 500 on an unexpected service error", async () => {
    MockedCategoryService.updateCategory.mockRejectedValue(new Error("db down"));

    const res = await PATCH(makeRequest({ name: "New Name" }), makeParams("1"));

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/categories/[category_id]", () => {
  it("returns 204 on successful deactivation", async () => {
    MockedCategoryService.deactivateCategory.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/categories/1", { method: "DELETE" });
    const res = await DELETE(req, makeParams("1"));

    expect(res.status).toBe(204);
    expect(MockedCategoryService.deactivateCategory).toHaveBeenCalledWith(1);
  });

  it("returns 404 when the category does not exist", async () => {
    MockedCategoryService.deactivateCategory.mockRejectedValue(
      new NotFoundException("Category not found"),
    );

    const req = new NextRequest("http://localhost/api/categories/999", { method: "DELETE" });
    const res = await DELETE(req, makeParams("999"));

    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric category_id without calling the service", async () => {
    const req = new NextRequest("http://localhost/api/categories/abc", { method: "DELETE" });
    const res = await DELETE(req, makeParams("abc"));

    expect(res.status).toBe(400);
    expect(MockedCategoryService.deactivateCategory).not.toHaveBeenCalled();
  });
});
