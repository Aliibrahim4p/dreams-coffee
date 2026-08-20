jest.mock("@/repository/sync-repository");

import { SyncRepository } from "@/repository/sync-repository";
import { SyncService } from "@/services/sync-service";
import { OrderSyncRecord } from "@/types/sync";

const MockedRepo = SyncRepository as jest.MockedClass<typeof SyncRepository>;

function mockRepo(overrides: Partial<Record<string, jest.Mock>>) {
  MockedRepo.mockImplementation(() => overrides as unknown as SyncRepository);
}

const record: OrderSyncRecord = {
  order_id: "order-1",
  session_id: "session-1",
  total_due: 5000,
  created_at: new Date("2026-08-01T10:00:00Z"),
  line_items: [{ product_id: 1, quantity: 1, unit_price: 5000 }],
};

describe("SyncService", () => {
  it("syncOrderRecords delegates to the repository", async () => {
    const syncOrderRecords = jest.fn().mockResolvedValue([
      { order_id: "order-1", sync_status: "synced", synced_at: new Date() },
    ]);
    mockRepo({ syncOrderRecords });

    await SyncService.syncOrderRecords([record]);

    expect(syncOrderRecords).toHaveBeenCalledWith([record]);
  });
});
