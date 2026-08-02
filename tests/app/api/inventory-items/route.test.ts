jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/inventory-item-service");

import { NextRequest } from "next/server";
import { InventoryItemService } from "@/services/inventory-item-service";
import UniqueException from "@/exceptions/unique-exception";
import { GET, POST } from "@/app/api/inventory-items/route";

const MockedInventoryItemService = InventoryItemService as jest.Mocked<typeof InventoryItemService>;

const validBody = { name: "Milk", unit: "ml", count_frequency: "daily" };

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/inventory-items", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/inventory-items", () => {
  it("returns 201 with the created item", async () => {
    MockedInventoryItemService.createInventoryItem.mockResolvedValue({
      item_id: 1,
      name: "Milk",
      unit: "ml",
      current_stock: 0,
      count_frequency: "daily",
      is_negative_flag: false,
      is_active: true,
    });

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(201);
  });

  it("returns 400 for an invalid unit", async () => {
    const res = await POST(makePostRequest({ ...validBody, unit: "liters" }));
    expect(res.status).toBe(400);
    expect(MockedInventoryItemService.createInventoryItem).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/inventory-items", {
      method: "POST",
      body: "not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(MockedInventoryItemService.createInventoryItem).not.toHaveBeenCalled();
  });

  it("returns 409 when the item name already exists", async () => {
    MockedInventoryItemService.createInventoryItem.mockRejectedValue(
      new UniqueException("Item name already exists"),
    );

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(409);
  });

  it("returns 500 on an unexpected service error", async () => {
    MockedInventoryItemService.createInventoryItem.mockRejectedValue(new Error("db down"));

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(500);
  });
});

describe("GET /api/inventory-items", () => {
  it("passes query filters through to the service", async () => {
    MockedInventoryItemService.listInventoryItems.mockResolvedValue([]);

    await GET(new NextRequest("http://localhost/api/inventory-items?count_frequency=daily&negative_only=true"));

    expect(MockedInventoryItemService.listInventoryItems).toHaveBeenCalledWith("daily", true, false);
  });

  it("passes undefined and false when no query params are set", async () => {
    MockedInventoryItemService.listInventoryItems.mockResolvedValue([]);

    await GET(new NextRequest("http://localhost/api/inventory-items"));

    expect(MockedInventoryItemService.listInventoryItems).toHaveBeenCalledWith(undefined, false, false);
  });

  it("passes include_inactive=true through to the service", async () => {
    MockedInventoryItemService.listInventoryItems.mockResolvedValue([]);

    await GET(new NextRequest("http://localhost/api/inventory-items?include_inactive=true"));

    expect(MockedInventoryItemService.listInventoryItems).toHaveBeenCalledWith(undefined, false, true);
  });

  it("returns 400 for an invalid count_frequency without calling the service", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/inventory-items?count_frequency=weekly"),
    );

    expect(res.status).toBe(400);
    expect(MockedInventoryItemService.listInventoryItems).not.toHaveBeenCalled();
  });

  it("returns 500 on an unexpected service error", async () => {
    MockedInventoryItemService.listInventoryItems.mockRejectedValue(new Error("db down"));

    const res = await GET(new NextRequest("http://localhost/api/inventory-items"));

    expect(res.status).toBe(500);
  });
});
