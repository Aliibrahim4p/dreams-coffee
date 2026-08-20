jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/inventory-count-entry-service");

import { NextRequest } from "next/server";
import { InventoryCountEntryService } from "@/services/inventory-count-entry-service";
import NotFoundException from "@/exceptions/not-found-exception";
import { GET } from "@/app/api/inventory-count-entries/[count_id]/route";

const MockedService = InventoryCountEntryService as jest.Mocked<typeof InventoryCountEntryService>;

function makeParams(count_id: string) {
  return { params: Promise.resolve({ count_id }) };
}

describe("GET /api/inventory-count-entries/[count_id]", () => {
  it("returns 200 with the entry", async () => {
    MockedService.getEntry.mockResolvedValue({
      count_id: "1",
      item_id: 1,
      item_name: "Milk",
      manager_id: 2,
      physical_count: 10,
      expected_stock: 100,
      variance: -90,
      entry_date: new Date(),
      is_locked: false,
      sync_status: "pending",
      synced_at: null,
    });

    const req = new NextRequest("http://localhost/api/inventory-count-entries/1");
    const res = await GET(req, makeParams("1"));

    expect(res.status).toBe(200);
    expect(MockedService.getEntry).toHaveBeenCalledWith("1");
  });

  it("returns 404 when the entry does not exist", async () => {
    MockedService.getEntry.mockRejectedValue(new NotFoundException("Count entry not found"));

    const req = new NextRequest("http://localhost/api/inventory-count-entries/missing");
    const res = await GET(req, makeParams("missing"));

    expect(res.status).toBe(404);
  });
});
