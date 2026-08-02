jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/inventory-item-service");

import { NextRequest } from "next/server";
import { InventoryItemService } from "@/services/inventory-item-service";
import NotFoundException from "@/exceptions/not-found-exception";
import { GET } from "@/app/api/inventory-items/[item_id]/pack-configurations/route";

const MockedInventoryItemService = InventoryItemService as jest.Mocked<typeof InventoryItemService>;

function makeParams(item_id: string) {
  return { params: Promise.resolve({ item_id }) };
}

describe("GET /api/inventory-items/[item_id]/pack-configurations", () => {
  it("returns 200 with the pack configurations", async () => {
    MockedInventoryItemService.getPackConfigurations.mockResolvedValue([
      { config_id: 1, item_id: 1, pack_name: "box", base_unit_qty: 12 },
    ]);

    const req = new NextRequest("http://localhost/api/inventory-items/1/pack-configurations");
    const res = await GET(req, makeParams("1"));

    expect(res.status).toBe(200);
    expect(MockedInventoryItemService.getPackConfigurations).toHaveBeenCalledWith(1);
  });

  it("returns 404 when the item does not exist", async () => {
    MockedInventoryItemService.getPackConfigurations.mockRejectedValue(
      new NotFoundException("Item not found"),
    );

    const req = new NextRequest("http://localhost/api/inventory-items/999/pack-configurations");
    const res = await GET(req, makeParams("999"));

    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric item_id without calling the service", async () => {
    const req = new NextRequest("http://localhost/api/inventory-items/abc/pack-configurations");
    const res = await GET(req, makeParams("abc"));

    expect(res.status).toBe(400);
    expect(MockedInventoryItemService.getPackConfigurations).not.toHaveBeenCalled();
  });
});
