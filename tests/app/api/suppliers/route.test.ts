jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/supplier-service");

import { NextRequest } from "next/server";
import { SupplierService } from "@/services/supplier-service";
import { GET, POST } from "@/app/api/suppliers/route";

const MockedSupplierService = SupplierService as jest.Mocked<typeof SupplierService>;

describe("GET /api/suppliers", () => {
  function makeGetRequest(query = "") {
    return new NextRequest(`http://localhost/api/suppliers${query}`);
  }

  it("returns 200 with the supplier list", async () => {
    MockedSupplierService.listSuppliers.mockResolvedValue([
      { supplier_id: 1, name: "Acme", is_active: true },
    ]);

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    expect(MockedSupplierService.listSuppliers).toHaveBeenCalledWith(false);
  });

  it("passes include_inactive=true through to the service", async () => {
    MockedSupplierService.listSuppliers.mockResolvedValue([]);

    await GET(makeGetRequest("?include_inactive=true"));

    expect(MockedSupplierService.listSuppliers).toHaveBeenCalledWith(true);
  });

  it("returns 500 on an unexpected service error", async () => {
    MockedSupplierService.listSuppliers.mockRejectedValue(new Error("db down"));

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(500);
  });
});

describe("POST /api/suppliers", () => {
  function makeRequest(body: unknown) {
    return new NextRequest("http://localhost/api/suppliers", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }

  it("returns 201 with the created supplier", async () => {
    MockedSupplierService.createSupplier.mockResolvedValue({
      supplier_id: 1,
      name: "Acme",
      is_active: true,
    });

    const res = await POST(makeRequest({ name: "Acme" }));

    expect(res.status).toBe(201);
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(MockedSupplierService.createSupplier).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/suppliers", {
      method: "POST",
      body: "not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(MockedSupplierService.createSupplier).not.toHaveBeenCalled();
  });

  it("returns 500 on an unexpected service error", async () => {
    MockedSupplierService.createSupplier.mockRejectedValue(new Error("db down"));

    const res = await POST(makeRequest({ name: "Acme" }));

    expect(res.status).toBe(500);
  });
});
