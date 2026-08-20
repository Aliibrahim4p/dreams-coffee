jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/delivery-service");

import { NextRequest } from "next/server";
import { DeliveryService } from "@/services/delivery-service";
import BadRequestException from "@/exceptions/bad-request-exception";
import { GET, POST } from "@/app/api/deliveries/route";

const MockedService = DeliveryService as jest.Mocked<typeof DeliveryService>;

const validBody = {
  supplier_id: 1,
  line_items: [{ item_id: 1, config_id: 1, qty_received: 2, total_cost: 2000 }],
};

function makePostRequest(body: unknown, managerId: string | null = "1") {
  return new NextRequest("http://localhost/api/deliveries", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...(managerId !== null ? { "x-manager-id": managerId } : {}),
    },
  });
}

describe("POST /api/deliveries", () => {
  it("returns 201 with the created delivery", async () => {
    MockedService.createDelivery.mockResolvedValue({
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

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(201);
    expect(MockedService.createDelivery).toHaveBeenCalledWith(validBody, 1);
  });

  it("returns 400 when line_items is empty", async () => {
    const res = await POST(makePostRequest({ ...validBody, line_items: [] }));
    expect(res.status).toBe(400);
    expect(MockedService.createDelivery).not.toHaveBeenCalled();
  });

  it("returns 400 when the item/config combination is invalid", async () => {
    MockedService.createDelivery.mockRejectedValue(
      new BadRequestException("item_id not in the predefined list, or config_id does not belong to that item"),
    );

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(400);
  });

  it("returns 400 when supplier_id or manager_id is invalid", async () => {
    MockedService.createDelivery.mockRejectedValue(new BadRequestException("Invalid supplier_id"));

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(400);
  });

  it("returns 401 when the x-manager-id header is missing (proxy bypassed)", async () => {
    const res = await POST(makePostRequest(validBody, null));

    expect(res.status).toBe(401);
    expect(MockedService.createDelivery).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/deliveries", {
      method: "POST",
      body: "not valid json",
      headers: { "content-type": "application/json", "x-manager-id": "1" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(MockedService.createDelivery).not.toHaveBeenCalled();
  });

  it("ignores a client-supplied date_received — it is server-derived, not an input field", async () => {
    MockedService.createDelivery.mockResolvedValue({
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

    const res = await POST(makePostRequest({ ...validBody, date_received: "not-a-date" }));

    expect(res.status).toBe(201);
    expect(MockedService.createDelivery).toHaveBeenCalledWith(validBody, 1);
  });

  it("returns 500 on an unexpected service error", async () => {
    MockedService.createDelivery.mockRejectedValue(new Error("db down"));

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(500);
  });
});

describe("GET /api/deliveries", () => {
  it("passes supplier_id through from the query string", async () => {
    MockedService.listDeliveries.mockResolvedValue([]);

    await GET(new NextRequest("http://localhost/api/deliveries?supplier_id=1"));

    expect(MockedService.listDeliveries).toHaveBeenCalledWith(undefined, 1);
  });

  it("parses date_received from the query string", async () => {
    MockedService.listDeliveries.mockResolvedValue([]);

    await GET(new NextRequest("http://localhost/api/deliveries?date_received=2026-07-31"));

    expect(MockedService.listDeliveries).toHaveBeenCalledWith(new Date("2026-07-31"), undefined);
  });

  it("returns 400 for an invalid date_received without calling the service", async () => {
    const res = await GET(new NextRequest("http://localhost/api/deliveries?date_received=not-a-date"));

    expect(res.status).toBe(400);
    expect(MockedService.listDeliveries).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-numeric supplier_id without calling the service", async () => {
    const res = await GET(new NextRequest("http://localhost/api/deliveries?supplier_id=abc"));

    expect(res.status).toBe(400);
    expect(MockedService.listDeliveries).not.toHaveBeenCalled();
  });

  it("returns 500 on an unexpected service error", async () => {
    MockedService.listDeliveries.mockRejectedValue(new Error("db down"));

    const res = await GET(new NextRequest("http://localhost/api/deliveries"));

    expect(res.status).toBe(500);
  });
});
