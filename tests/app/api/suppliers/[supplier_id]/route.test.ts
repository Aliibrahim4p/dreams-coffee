jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/supplier-service");

import { NextRequest } from "next/server";
import { SupplierService } from "@/services/supplier-service";
import NotFoundException from "@/exceptions/not-found-exception";
import { PATCH, DELETE } from "@/app/api/suppliers/[supplier_id]/route";

const MockedSupplierService = SupplierService as jest.Mocked<typeof SupplierService>;

function makeParams(supplier_id: string) {
  return { params: Promise.resolve({ supplier_id }) };
}

describe("PATCH /api/suppliers/[supplier_id]", () => {
  function makeRequest(body: unknown) {
    return new NextRequest("http://localhost/api/suppliers/1", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }

  it("returns 200 with the updated supplier", async () => {
    MockedSupplierService.updateSupplier.mockResolvedValue({
      supplier_id: 1,
      name: "New Name",
      is_active: true,
    });

    const res = await PATCH(makeRequest({ name: "New Name" }), makeParams("1"));

    expect(res.status).toBe(200);
  });

  it("returns 400 when name is missing", async () => {
    const res = await PATCH(makeRequest({}), makeParams("1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/suppliers/1", {
      method: "PATCH",
      body: "not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await PATCH(req, makeParams("1"));

    expect(res.status).toBe(400);
    expect(MockedSupplierService.updateSupplier).not.toHaveBeenCalled();
  });

  it("returns 404 when the supplier does not exist", async () => {
    MockedSupplierService.updateSupplier.mockRejectedValue(new NotFoundException("Supplier not found"));

    const res = await PATCH(makeRequest({ name: "New Name" }), makeParams("999"));

    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric supplier_id without calling the service", async () => {
    const res = await PATCH(makeRequest({ name: "New Name" }), makeParams("abc"));

    expect(res.status).toBe(400);
    expect(MockedSupplierService.updateSupplier).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/suppliers/[supplier_id]", () => {
  it("returns 204 on successful deactivation", async () => {
    MockedSupplierService.deactivateSupplier.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/suppliers/1", { method: "DELETE" });
    const res = await DELETE(req, makeParams("1"));

    expect(res.status).toBe(204);
  });

  it("returns 404 when the supplier does not exist", async () => {
    MockedSupplierService.deactivateSupplier.mockRejectedValue(
      new NotFoundException("Supplier not found"),
    );

    const req = new NextRequest("http://localhost/api/suppliers/999", { method: "DELETE" });
    const res = await DELETE(req, makeParams("999"));

    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric supplier_id without calling the service", async () => {
    const req = new NextRequest("http://localhost/api/suppliers/abc", { method: "DELETE" });
    const res = await DELETE(req, makeParams("abc"));

    expect(res.status).toBe(400);
    expect(MockedSupplierService.deactivateSupplier).not.toHaveBeenCalled();
  });
});
