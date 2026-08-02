jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/delivery-service");

import { NextRequest } from "next/server";
import { DeliveryService } from "@/services/delivery-service";
import NotFoundException from "@/exceptions/not-found-exception";
import { GET } from "@/app/api/deliveries/[delivery_id]/route";

const MockedService = DeliveryService as jest.Mocked<typeof DeliveryService>;

function makeParams(delivery_id: string) {
  return { params: Promise.resolve({ delivery_id }) };
}

describe("GET /api/deliveries/[delivery_id]", () => {
  it("returns 200 with the delivery", async () => {
    MockedService.getDelivery.mockResolvedValue({
      delivery_id: "1",
      manager_id: 1,
      supplier_id: 1,
      supplier_name: "Acme",
      date_received: new Date(),
      notes: null,
      sync_status: "pending",
      synced_at: null,
      line_items: [],
    });

    const req = new NextRequest("http://localhost/api/deliveries/1");
    const res = await GET(req, makeParams("1"));

    expect(res.status).toBe(200);
  });

  it("returns 404 when the delivery does not exist", async () => {
    MockedService.getDelivery.mockRejectedValue(new NotFoundException("Delivery not found"));

    const req = new NextRequest("http://localhost/api/deliveries/missing");
    const res = await GET(req, makeParams("missing"));

    expect(res.status).toBe(404);
  });
});
