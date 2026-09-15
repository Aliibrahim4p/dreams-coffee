jest.mock("@/lib/r2", () => ({ __esModule: true, default: {}, R2_BUCKET: "test-bucket" }));
jest.mock("@/services/staging-service");

import { StagingService } from "@/services/staging-service";
import StagingStorageException from "@/exceptions/staging-storage-exception";
import { POST } from "@/app/api/sync/staging/process/route";

const MockedService = StagingService as jest.Mocked<typeof StagingService>;

describe("POST /api/sync/staging/process", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 200 with an empty processed list when nothing is staged", async () => {
    MockedService.processStaged.mockResolvedValue([]);

    const res = await POST();

    expect(res.status).toBe(200);
    expect((await res.json()).processed).toEqual([]);
  });

  it("returns 200 with a newly-synced order", async () => {
    MockedService.processStaged.mockResolvedValue([
      { key: "staging/order-1.json", order_id: "order-1", outcome: "synced", synced_at: new Date("2026-08-01T10:00:00Z") },
    ]);

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.processed[0].outcome).toBe("synced");
  });

  it("returns 200 with already_synced for an order that was already in Postgres", async () => {
    MockedService.processStaged.mockResolvedValue([
      { key: "staging/order-1.json", order_id: "order-1", outcome: "already_synced", synced_at: null },
    ]);

    const res = await POST();
    const json = await res.json();

    expect(json.processed[0].outcome).toBe("already_synced");
  });

  it("returns 200 with a still-failing order", async () => {
    MockedService.processStaged.mockResolvedValue([
      { key: "staging/order-1.json", order_id: "order-1", outcome: "failed" },
    ]);

    const res = await POST();
    const json = await res.json();

    expect(json.processed[0]).toEqual({ key: "staging/order-1.json", order_id: "order-1", outcome: "failed" });
  });

  it("returns 200 with STAGED_BLOB_CORRUPT for a corrupt blob mixed with a good one", async () => {
    MockedService.processStaged.mockResolvedValue([
      { key: "staging/order-1.json", order_id: null, code: "STAGED_BLOB_CORRUPT", message: "invalid JSON" },
      { key: "staging/order-2.json", order_id: "order-2", outcome: "synced", synced_at: new Date() },
    ]);

    const res = await POST();
    const json = await res.json();

    expect(json.processed[0].code).toBe("STAGED_BLOB_CORRUPT");
    expect(json.processed[1].outcome).toBe("synced");
  });

  it("returns 503 when listing staged objects fails", async () => {
    MockedService.processStaged.mockRejectedValue(new StagingStorageException("r2 down"));

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json).toEqual({ code: "STAGING_STORAGE_UNAVAILABLE", message: "r2 down" });
  });

  it("returns 500 on an unexpected service error", async () => {
    MockedService.processStaged.mockRejectedValue(new Error("bug"));

    const res = await POST();

    expect(res.status).toBe(500);
  });
});
