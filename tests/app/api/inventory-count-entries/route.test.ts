jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/inventory-count-entry-service");

import { NextRequest } from "next/server";
import { InventoryCountEntryService } from "@/services/inventory-count-entry-service";
import DuplicateCountEntryException from "@/exceptions/duplicate-count-entry-exception";
import BadRequestException from "@/exceptions/bad-request-exception";
import { GET, POST } from "@/app/api/inventory-count-entries/route";

const MockedService = InventoryCountEntryService as jest.Mocked<typeof InventoryCountEntryService>;

const validBody = { item_id: 1, physical_count: 10 };

function makePostRequest(body: unknown, managerId: string | null = "2") {
  return new NextRequest("http://localhost/api/inventory-count-entries", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...(managerId !== null ? { "x-manager-id": managerId } : {}),
    },
  });
}

describe("POST /api/inventory-count-entries", () => {
  it("returns 201 with the created entry", async () => {
    MockedService.createEntry.mockResolvedValue({
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

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(201);
    expect(MockedService.createEntry).toHaveBeenCalledWith(validBody, 2);
  });

  it("returns 400 when item_id is not in the predefined list", async () => {
    MockedService.createEntry.mockRejectedValue(
      new BadRequestException("item_id not in the predefined list"),
    );

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(400);
  });

  it("returns 409 with code and count_id when an entry already exists for today", async () => {
    MockedService.createEntry.mockRejectedValue(
      new DuplicateCountEntryException("already exists", "existing-id"),
    );

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      code: "CONFLICT",
      message: "already exists",
      count_id: "existing-id",
    });
  });

  it("returns 400 when manager_id does not exist", async () => {
    MockedService.createEntry.mockRejectedValue(new BadRequestException("Invalid manager_id"));

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(400);
  });

  it("returns 401 when the x-manager-id header is missing (proxy bypassed)", async () => {
    const res = await POST(makePostRequest(validBody, null));

    expect(res.status).toBe(401);
    expect(MockedService.createEntry).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/inventory-count-entries", {
      method: "POST",
      body: "not valid json",
      headers: { "content-type": "application/json", "x-manager-id": "2" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(MockedService.createEntry).not.toHaveBeenCalled();
  });

  it("returns 500 on an unexpected service error", async () => {
    MockedService.createEntry.mockRejectedValue(new Error("db down"));

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(500);
  });
});

describe("GET /api/inventory-count-entries", () => {
  it("passes item_id through and defaults entry_date to undefined (today)", async () => {
    MockedService.listEntries.mockResolvedValue([]);

    await GET(new NextRequest("http://localhost/api/inventory-count-entries?item_id=1"));

    expect(MockedService.listEntries).toHaveBeenCalledWith(undefined, 1);
  });

  it("parses entry_date from the query string", async () => {
    MockedService.listEntries.mockResolvedValue([]);

    await GET(new NextRequest("http://localhost/api/inventory-count-entries?entry_date=2026-07-31"));

    expect(MockedService.listEntries).toHaveBeenCalledWith(new Date("2026-07-31"), undefined);
  });

  it("returns 400 for an invalid entry_date without calling the service", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/inventory-count-entries?entry_date=not-a-date"),
    );

    expect(res.status).toBe(400);
    expect(MockedService.listEntries).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-numeric item_id without calling the service", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/inventory-count-entries?item_id=abc"),
    );

    expect(res.status).toBe(400);
    expect(MockedService.listEntries).not.toHaveBeenCalled();
  });

  it("returns 500 on an unexpected service error", async () => {
    MockedService.listEntries.mockRejectedValue(new Error("db down"));

    const res = await GET(new NextRequest("http://localhost/api/inventory-count-entries"));

    expect(res.status).toBe(500);
  });
});
