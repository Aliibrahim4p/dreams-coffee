jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/category-service");

import { NextRequest } from "next/server";
import { CategoryService } from "@/services/category-service";
import UniqueException from "@/exceptions/unique-exception";
import { GET, POST } from "@/app/api/categories/route";

const MockedCategoryService = CategoryService as jest.Mocked<typeof CategoryService>;

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/category", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/category", () => {
  it("returns 201 with the created category on success", async () => {
    MockedCategoryService.createCategory.mockResolvedValue({
      category_id: 1,
      name: "Coffee",
      is_active: true,
    });

    const res = await POST(makeRequest({ name: "Coffee" }));

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({
      category: { category_id: 1, name: "Coffee", is_active: true },
    });
  });

  it("returns 400 and does not call the service when name is missing", async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    expect(MockedCategoryService.createCategory).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/category", {
      method: "POST",
      body: "not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(MockedCategoryService.createCategory).not.toHaveBeenCalled();
  });

  it("returns 400 when name is an empty string", async () => {
    const res = await POST(makeRequest({ name: "" }));

    expect(res.status).toBe(400);
  });

  it("returns 400 when name exceeds 40 characters", async () => {
    const res = await POST(makeRequest({ name: "a".repeat(41) }));

    expect(res.status).toBe(400);
  });

  it("returns 409 when the category name already exists", async () => {
    MockedCategoryService.createCategory.mockRejectedValue(
      new UniqueException("Category name must be unique"),
    );

    const res = await POST(makeRequest({ name: "Coffee" }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "Category name must be unique",
    });
  });

  it("returns 500 on unexpected errors", async () => {
    MockedCategoryService.createCategory.mockRejectedValue(new Error("db down"));

    const res = await POST(makeRequest({ name: "Coffee" }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal Server Error" });
  });
});

describe("GET /api/categories", () => {
  function makeGetRequest(url: string) {
    return new NextRequest(url);
  }

  it("returns 200 with plain categories when include=products is absent", async () => {
    MockedCategoryService.listCategories.mockResolvedValue([
      { category_id: 1, name: "Coffee", is_active: true },
    ]);

    const res = await GET(makeGetRequest("http://localhost/api/categories"));

    expect(res.status).toBe(200);
    expect(MockedCategoryService.listCategories).toHaveBeenCalledWith(false, false);
    await expect(res.json()).resolves.toEqual([
      { category_id: 1, name: "Coffee", is_active: true },
    ]);
  });

  it("passes includeProducts=true when include=products is set", async () => {
    MockedCategoryService.listCategories.mockResolvedValue([]);

    await GET(makeGetRequest("http://localhost/api/categories?include=products"));

    expect(MockedCategoryService.listCategories).toHaveBeenCalledWith(true, false);
  });

  it("passes include_inactive=true through to the service", async () => {
    MockedCategoryService.listCategories.mockResolvedValue([]);

    await GET(makeGetRequest("http://localhost/api/categories?include_inactive=true"));

    expect(MockedCategoryService.listCategories).toHaveBeenCalledWith(false, true);
  });

  it("returns 500 on an unexpected service error", async () => {
    MockedCategoryService.listCategories.mockRejectedValue(new Error("db down"));

    const res = await GET(makeGetRequest("http://localhost/api/categories"));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal Server Error" });
  });
});
