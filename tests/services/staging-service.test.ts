jest.mock("@/repository/staging-repository");
jest.mock("@/repository/product-repository");
jest.mock("@/repository/sync-repository");
jest.mock("@/repository/shift-session-repository");
jest.mock("@/services/sync-service");

import { StagingRepository } from "@/repository/staging-repository";
import { ProductRepository } from "@/repository/product-repository";
import { SyncRepository } from "@/repository/sync-repository";
import { ShiftSessionRepository } from "@/repository/shift-session-repository";
import { SyncService } from "@/services/sync-service";
import { StagingService } from "@/services/staging-service";
import { StagingOrderRecord } from "@/types/staging";
import StagingStorageException from "@/exceptions/staging-storage-exception";
import NotFoundException from "@/exceptions/not-found-exception";
import BadRequestException from "@/exceptions/bad-request-exception";

const MockedStagingRepo = StagingRepository as jest.MockedClass<typeof StagingRepository>;
const MockedProductRepo = ProductRepository as jest.MockedClass<typeof ProductRepository>;
const MockedSyncRepo = SyncRepository as jest.MockedClass<typeof SyncRepository>;
const MockedShiftSessionRepo = ShiftSessionRepository as jest.MockedClass<typeof ShiftSessionRepository>;
const MockedSyncService = SyncService as jest.Mocked<typeof SyncService>;

function mockStagingRepo(overrides: Partial<Record<string, jest.Mock>>) {
  MockedStagingRepo.mockImplementation(() => overrides as unknown as StagingRepository);
}
function mockProductRepo(overrides: Partial<Record<string, jest.Mock>>) {
  MockedProductRepo.mockImplementation(() => overrides as unknown as ProductRepository);
}
function mockSyncRepo(overrides: Partial<Record<string, jest.Mock>>) {
  MockedSyncRepo.mockImplementation(() => overrides as unknown as SyncRepository);
}
function mockShiftSessionRepo(overrides: Partial<Record<string, jest.Mock>>) {
  MockedShiftSessionRepo.mockImplementation(() => overrides as unknown as ShiftSessionRepository);
}

const rawRecord: StagingOrderRecord = {
  order_id: "order-1",
  session_id: "session-1",
  order_type: "dine_in",
  created_at: new Date("2026-08-01T10:00:00Z"),
  line_items: [{ product_id: 1, modifier_id: null, unit_price: 5000 }],
};

describe("StagingService.stageRecords", () => {
  beforeEach(() => jest.clearAllMocks());

  it("stores each raw record as-is and returns its key", async () => {
    const putOrder = jest.fn().mockResolvedValue("staging/order-1.json");
    mockStagingRepo({ putOrder });

    const results = await StagingService.stageRecords([rawRecord]);

    expect(putOrder).toHaveBeenCalledWith("order-1", JSON.stringify(rawRecord));
    expect(results).toEqual([{ order_id: "order-1", staged: true, key: "staging/order-1.json" }]);
  });

  it("reports STAGING_STORAGE_UNAVAILABLE for a record that fails to write, without affecting the others", async () => {
    const putOrder = jest
      .fn()
      .mockRejectedValueOnce(new StagingStorageException("r2 down"))
      .mockResolvedValueOnce("staging/order-2.json");
    mockStagingRepo({ putOrder });

    const results = await StagingService.stageRecords([rawRecord, { ...rawRecord, order_id: "order-2" }]);

    expect(results).toEqual([
      { order_id: "order-1", staged: false, code: "STAGING_STORAGE_UNAVAILABLE", message: "r2 down" },
      { order_id: "order-2", staged: true, key: "staging/order-2.json" },
    ]);
  });

  it("rethrows an unexpected error instead of swallowing it as a per-record result", async () => {
    const putOrder = jest.fn().mockRejectedValue(new Error("bug"));
    mockStagingRepo({ putOrder });

    await expect(StagingService.stageRecords([rawRecord])).rejects.toThrow("bug");
  });
});

describe("StagingService.processStaged", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default every test to an open session unless a test overrides it — most tests here
    // are about price/cash/sync behavior, not session validity.
    mockShiftSessionRepo({ isOpenSession: jest.fn().mockResolvedValue(true) });
  });

  it("returns an empty array when nothing is staged", async () => {
    mockStagingRepo({ listStagedKeys: jest.fn().mockResolvedValue([]) });

    expect(await StagingService.processStaged()).toEqual([]);
  });

  it("checks all staged order_ids against Postgres in a single call, not once per key", async () => {
    const findExistingOrderIds = jest.fn().mockResolvedValue(new Set());
    mockStagingRepo({
      listStagedKeys: jest.fn().mockResolvedValue(["staging/order-1.json", "staging/order-2.json"]),
      getObject: jest.fn().mockResolvedValue(JSON.stringify(rawRecord)),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    });
    mockSyncRepo({ findExistingOrderIds });
    mockProductRepo({ resolveLineItemPrices: jest.fn().mockResolvedValue(new Map([["1:null", 5000]])) });
    MockedSyncService.syncOrderRecords.mockResolvedValue([
      { order_id: "order-1", sync_status: "synced", synced_at: new Date() },
    ]);

    await StagingService.processStaged();

    expect(findExistingOrderIds).toHaveBeenCalledTimes(1);
    expect(findExistingOrderIds).toHaveBeenCalledWith(["order-1", "order-2"]);
  });

  it("skips syncing and deletes the blob for an order already in Postgres", async () => {
    const deleteObject = jest.fn().mockResolvedValue(undefined);
    mockStagingRepo({
      listStagedKeys: jest.fn().mockResolvedValue(["staging/order-1.json"]),
      deleteObject,
    });
    mockSyncRepo({ findExistingOrderIds: jest.fn().mockResolvedValue(new Set(["order-1"])) });

    const results = await StagingService.processStaged();

    expect(results).toEqual([{ key: "staging/order-1.json", order_id: "order-1", outcome: "already_synced", synced_at: null }]);
    expect(deleteObject).toHaveBeenCalledWith("staging/order-1.json");
    expect(MockedSyncService.syncOrderRecords).not.toHaveBeenCalled();
  });

  it("resolves price, aggregates quantity, computes total_due, syncs, and deletes on success", async () => {
    const repeatedItemRecord: StagingOrderRecord = {
      ...rawRecord,
      line_items: [
        { product_id: 1, modifier_id: null, unit_price: 5000 },
        { product_id: 1, modifier_id: null, unit_price: 5000 },
      ],
    };
    const deleteObject = jest.fn().mockResolvedValue(undefined);
    mockStagingRepo({
      listStagedKeys: jest.fn().mockResolvedValue(["staging/order-1.json"]),
      getObject: jest.fn().mockResolvedValue(JSON.stringify(repeatedItemRecord)),
      deleteObject,
    });
    mockSyncRepo({ findExistingOrderIds: jest.fn().mockResolvedValue(new Set()) });
    mockProductRepo({ resolveLineItemPrices: jest.fn().mockResolvedValue(new Map([["1:null", 5000]])) });
    MockedSyncService.syncOrderRecords.mockResolvedValue([
      { order_id: "order-1", sync_status: "synced", synced_at: new Date("2026-08-01T11:00:00Z") },
    ]);

    const results = await StagingService.processStaged();

    expect(MockedSyncService.syncOrderRecords).toHaveBeenCalledWith([
      expect.objectContaining({
        order_id: "order-1",
        total_due: 10000,
        line_items: [{ product_id: 1, modifier_id: null, quantity: 2, unit_price: 5000 }],
        // rawRecord/repeatedItemRecord sends neither cash_tendered nor change_given —
        // defaults to "paid exactly, no change" rather than storing null.
        cash_tendered: 10000,
        change_given: 0,
      }),
    ]);
    expect(deleteObject).toHaveBeenCalledWith("staging/order-1.json");
    expect(results).toEqual([
      { key: "staging/order-1.json", order_id: "order-1", outcome: "synced", synced_at: new Date("2026-08-01T11:00:00Z") },
    ]);
  });

  it("defaults change_given to 0 when only cash_tendered is sent, and still validates it", async () => {
    const partialCashRecord: StagingOrderRecord = { ...rawRecord, cash_tendered: 5000 };
    mockStagingRepo({
      listStagedKeys: jest.fn().mockResolvedValue(["staging/order-1.json"]),
      getObject: jest.fn().mockResolvedValue(JSON.stringify(partialCashRecord)),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    });
    mockSyncRepo({ findExistingOrderIds: jest.fn().mockResolvedValue(new Set()) });
    mockProductRepo({ resolveLineItemPrices: jest.fn().mockResolvedValue(new Map([["1:null", 5000]])) });
    MockedSyncService.syncOrderRecords.mockResolvedValue([
      { order_id: "order-1", sync_status: "synced", synced_at: new Date() },
    ]);

    await StagingService.processStaged();

    expect(MockedSyncService.syncOrderRecords).toHaveBeenCalledWith([
      expect.objectContaining({ cash_tendered: 5000, change_given: 0 }),
    ]);
  });

  it("defaults a refund's cash_tendered to its (negative) total_due, matching the seed data convention", async () => {
    const refundNoCash: StagingOrderRecord = { ...rawRecord, transaction_type: "refund", order_type: null };
    mockStagingRepo({
      listStagedKeys: jest.fn().mockResolvedValue(["staging/order-1.json"]),
      getObject: jest.fn().mockResolvedValue(JSON.stringify(refundNoCash)),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    });
    mockSyncRepo({ findExistingOrderIds: jest.fn().mockResolvedValue(new Set()) });
    mockProductRepo({ resolveLineItemPrices: jest.fn().mockResolvedValue(new Map([["1:null", 5000]])) });
    MockedSyncService.syncOrderRecords.mockResolvedValue([
      { order_id: "order-1", sync_status: "synced", synced_at: new Date() },
    ]);

    await StagingService.processStaged();

    expect(MockedSyncService.syncOrderRecords).toHaveBeenCalledWith([
      expect.objectContaining({ total_due: -5000, cash_tendered: -5000, change_given: 0 }),
    ]);
  });

  it("negates total_due for a refund, and skips the cash reconciliation check entirely for it", async () => {
    // cash_tendered can never be negative (schema-enforced) so it could never reconcile against
    // a refund's negative total_due anyway — this value would fail CASH_TOTAL_MISMATCH if the
    // check ran, proving it's actually skipped rather than happening to pass.
    const refundRecord: StagingOrderRecord = {
      ...rawRecord,
      transaction_type: "refund",
      order_type: null,
      cash_tendered: 999999,
      change_given: 0,
    };
    mockStagingRepo({
      listStagedKeys: jest.fn().mockResolvedValue(["staging/order-1.json"]),
      getObject: jest.fn().mockResolvedValue(JSON.stringify(refundRecord)),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    });
    mockSyncRepo({ findExistingOrderIds: jest.fn().mockResolvedValue(new Set()) });
    mockProductRepo({ resolveLineItemPrices: jest.fn().mockResolvedValue(new Map([["1:null", 5000]])) });
    MockedSyncService.syncOrderRecords.mockResolvedValue([
      { order_id: "order-1", sync_status: "synced", synced_at: new Date() },
    ]);

    const results = await StagingService.processStaged();

    expect(MockedSyncService.syncOrderRecords).toHaveBeenCalledWith([
      expect.objectContaining({ total_due: -5000 }),
    ]);
    expect(results[0]).toMatchObject({ outcome: "synced" });
  });

  it("leaves the blob in place and reports a plain failure when SyncService reports failed", async () => {
    const deleteObject = jest.fn();
    const putOrder = jest.fn().mockResolvedValue("staging/order-1.json");
    mockStagingRepo({
      listStagedKeys: jest.fn().mockResolvedValue(["staging/order-1.json"]),
      getObject: jest.fn().mockResolvedValue(JSON.stringify(rawRecord)),
      deleteObject,
      putOrder,
    });
    mockSyncRepo({ findExistingOrderIds: jest.fn().mockResolvedValue(new Set()) });
    mockProductRepo({ resolveLineItemPrices: jest.fn().mockResolvedValue(new Map([["1:null", 5000]])) });
    MockedSyncService.syncOrderRecords.mockResolvedValue([
      { order_id: "order-1", sync_status: "failed", synced_at: null },
    ]);

    const results = await StagingService.processStaged();

    expect(results).toEqual([{ key: "staging/order-1.json", order_id: "order-1", outcome: "failed" }]);
    expect(deleteObject).not.toHaveBeenCalled();

    expect(putOrder).toHaveBeenCalledWith("order-1", expect.any(String));
    const annotated = JSON.parse(putOrder.mock.calls[0][1]);
    expect(annotated._staging_error).toEqual({ code: null, message: expect.any(String), failed_at: expect.any(String) });
    expect(annotated.order_id).toBe("order-1"); // original record fields preserved
  });

  it("reports CASH_TOTAL_MISMATCH and never calls SyncService when cash reconciliation fails", async () => {
    const mismatchRecord: StagingOrderRecord = { ...rawRecord, cash_tendered: 10000, change_given: 0 };
    const deleteObject = jest.fn();
    const putOrder = jest.fn().mockResolvedValue("staging/order-1.json");
    mockStagingRepo({
      listStagedKeys: jest.fn().mockResolvedValue(["staging/order-1.json"]),
      getObject: jest.fn().mockResolvedValue(JSON.stringify(mismatchRecord)),
      deleteObject,
      putOrder,
    });
    mockSyncRepo({ findExistingOrderIds: jest.fn().mockResolvedValue(new Set()) });
    mockProductRepo({ resolveLineItemPrices: jest.fn().mockResolvedValue(new Map([["1:null", 5000]])) });

    const results = await StagingService.processStaged();

    expect(results).toEqual([
      { key: "staging/order-1.json", order_id: "order-1", outcome: "failed", code: "CASH_TOTAL_MISMATCH", message: expect.any(String) },
    ]);
    expect(MockedSyncService.syncOrderRecords).not.toHaveBeenCalled();
    expect(deleteObject).not.toHaveBeenCalled();

    const annotated = JSON.parse(putOrder.mock.calls[0][1]);
    expect(annotated._staging_error.code).toBe("CASH_TOTAL_MISMATCH");
  });

  it("reports INVALID_SESSION when the session doesn't exist or isn't open, blob left in place, nothing else attempted", async () => {
    const deleteObject = jest.fn();
    const putOrder = jest.fn().mockResolvedValue("staging/order-1.json");
    mockStagingRepo({
      listStagedKeys: jest.fn().mockResolvedValue(["staging/order-1.json"]),
      getObject: jest.fn().mockResolvedValue(JSON.stringify(rawRecord)),
      deleteObject,
      putOrder,
    });
    mockSyncRepo({ findExistingOrderIds: jest.fn().mockResolvedValue(new Set()) });
    mockShiftSessionRepo({ isOpenSession: jest.fn().mockResolvedValue(false) });
    const resolveLineItemPrices = jest.fn();
    mockProductRepo({ resolveLineItemPrices });

    const results = await StagingService.processStaged();

    expect(results).toEqual([
      { key: "staging/order-1.json", order_id: "order-1", outcome: "failed", code: "INVALID_SESSION", message: expect.any(String) },
    ]);
    expect(resolveLineItemPrices).not.toHaveBeenCalled();
    expect(MockedSyncService.syncOrderRecords).not.toHaveBeenCalled();
    expect(deleteObject).not.toHaveBeenCalled();

    const annotated = JSON.parse(putOrder.mock.calls[0][1]);
    expect(annotated._staging_error.code).toBe("INVALID_SESSION");
  });

  it("reports INVALID_ORDER_TYPE for a sale staged without order_type — accepted at staging, rejected here", async () => {
    const { order_type, ...saleNoType } = rawRecord;
    void order_type;
    const deleteObject = jest.fn();
    const putOrder = jest.fn().mockResolvedValue("staging/order-1.json");
    mockStagingRepo({
      listStagedKeys: jest.fn().mockResolvedValue(["staging/order-1.json"]),
      getObject: jest.fn().mockResolvedValue(JSON.stringify(saleNoType)),
      deleteObject,
      putOrder,
    });
    mockSyncRepo({ findExistingOrderIds: jest.fn().mockResolvedValue(new Set()) });
    const resolveLineItemPrices = jest.fn();
    mockProductRepo({ resolveLineItemPrices });

    const results = await StagingService.processStaged();

    expect(results).toEqual([
      { key: "staging/order-1.json", order_id: "order-1", outcome: "failed", code: "INVALID_ORDER_TYPE", message: expect.any(String) },
    ]);
    expect(resolveLineItemPrices).not.toHaveBeenCalled();
    expect(MockedSyncService.syncOrderRecords).not.toHaveBeenCalled();
    expect(deleteObject).not.toHaveBeenCalled();

    const annotated = JSON.parse(putOrder.mock.calls[0][1]);
    expect(annotated._staging_error.code).toBe("INVALID_ORDER_TYPE");
  });

  it("reports INVALID_ORDER_TYPE for a refund staged with order_type set", async () => {
    const refundWithType: StagingOrderRecord = { ...rawRecord, transaction_type: "refund", order_type: "dine_in" };
    mockStagingRepo({
      listStagedKeys: jest.fn().mockResolvedValue(["staging/order-1.json"]),
      getObject: jest.fn().mockResolvedValue(JSON.stringify(refundWithType)),
      putOrder: jest.fn().mockResolvedValue("staging/order-1.json"),
    });
    mockSyncRepo({ findExistingOrderIds: jest.fn().mockResolvedValue(new Set()) });

    const results = await StagingService.processStaged();

    expect(results).toEqual([
      { key: "staging/order-1.json", order_id: "order-1", outcome: "failed", code: "INVALID_ORDER_TYPE", message: expect.any(String) },
    ]);
  });

  it("reports PRICE_MISMATCH when the client-sent unit_price disagrees with the catalog, blob left in place", async () => {
    const staleRecord: StagingOrderRecord = {
      ...rawRecord,
      line_items: [{ product_id: 1, modifier_id: null, unit_price: 4000 }],
    };
    const deleteObject = jest.fn();
    const putOrder = jest.fn().mockResolvedValue("staging/order-1.json");
    mockStagingRepo({
      listStagedKeys: jest.fn().mockResolvedValue(["staging/order-1.json"]),
      getObject: jest.fn().mockResolvedValue(JSON.stringify(staleRecord)),
      deleteObject,
      putOrder,
    });
    mockSyncRepo({ findExistingOrderIds: jest.fn().mockResolvedValue(new Set()) });
    mockProductRepo({ resolveLineItemPrices: jest.fn().mockResolvedValue(new Map([["1:null", 5000]])) });

    const results = await StagingService.processStaged();

    expect(results).toEqual([
      { key: "staging/order-1.json", order_id: "order-1", outcome: "failed", code: "PRICE_MISMATCH", message: expect.any(String) },
    ]);
    expect(MockedSyncService.syncOrderRecords).not.toHaveBeenCalled();
    expect(deleteObject).not.toHaveBeenCalled();

    const annotated = JSON.parse(putOrder.mock.calls[0][1]);
    expect(annotated._staging_error.code).toBe("PRICE_MISMATCH");
  });

  it("reports PRODUCT_NOT_FOUND for an unknown product_id, blob left in place", async () => {
    const deleteObject = jest.fn();
    const putOrder = jest.fn().mockResolvedValue("staging/order-1.json");
    mockStagingRepo({
      listStagedKeys: jest.fn().mockResolvedValue(["staging/order-1.json"]),
      getObject: jest.fn().mockResolvedValue(JSON.stringify(rawRecord)),
      deleteObject,
      putOrder,
    });
    mockSyncRepo({ findExistingOrderIds: jest.fn().mockResolvedValue(new Set()) });
    mockProductRepo({
      resolveLineItemPrices: jest.fn().mockRejectedValue(new NotFoundException("Product 1 not found")),
    });

    const results = await StagingService.processStaged();

    expect(results).toEqual([
      { key: "staging/order-1.json", order_id: "order-1", outcome: "failed", code: "PRODUCT_NOT_FOUND", message: "Product 1 not found" },
    ]);
    expect(deleteObject).not.toHaveBeenCalled();

    const annotated = JSON.parse(putOrder.mock.calls[0][1]);
    expect(annotated._staging_error).toEqual({ code: "PRODUCT_NOT_FOUND", message: "Product 1 not found", failed_at: expect.any(String) });
  });

  it("reports INVALID_MODIFIER for an unknown modifier_id", async () => {
    const putOrder = jest.fn().mockResolvedValue("staging/order-1.json");
    mockStagingRepo({
      listStagedKeys: jest.fn().mockResolvedValue(["staging/order-1.json"]),
      getObject: jest.fn().mockResolvedValue(JSON.stringify(rawRecord)),
      deleteObject: jest.fn(),
      putOrder,
    });
    mockSyncRepo({ findExistingOrderIds: jest.fn().mockResolvedValue(new Set()) });
    mockProductRepo({
      resolveLineItemPrices: jest.fn().mockRejectedValue(new BadRequestException("Invalid modifier_id 2")),
    });

    const results = await StagingService.processStaged();

    expect(results).toEqual([
      { key: "staging/order-1.json", order_id: "order-1", outcome: "failed", code: "INVALID_MODIFIER", message: "Invalid modifier_id 2" },
    ]);

    const annotated = JSON.parse(putOrder.mock.calls[0][1]);
    expect(annotated._staging_error.code).toBe("INVALID_MODIFIER");
  });

  it("doesn't let a failed annotation write override the real failure result", async () => {
    const putOrder = jest.fn().mockRejectedValue(new Error("r2 write blip"));
    mockStagingRepo({
      listStagedKeys: jest.fn().mockResolvedValue(["staging/order-1.json"]),
      getObject: jest.fn().mockResolvedValue(JSON.stringify(rawRecord)),
      deleteObject: jest.fn(),
      putOrder,
    });
    mockSyncRepo({ findExistingOrderIds: jest.fn().mockResolvedValue(new Set()) });
    mockProductRepo({
      resolveLineItemPrices: jest.fn().mockRejectedValue(new NotFoundException("Product 1 not found")),
    });

    const results = await StagingService.processStaged();

    expect(results).toEqual([
      { key: "staging/order-1.json", order_id: "order-1", outcome: "failed", code: "PRODUCT_NOT_FOUND", message: "Product 1 not found" },
    ]);
  });

  it("reports STAGED_BLOB_CORRUPT for unparseable JSON and continues to the next key", async () => {
    mockStagingRepo({
      listStagedKeys: jest.fn().mockResolvedValue(["staging/order-1.json", "staging/order-2.json"]),
      getObject: jest
        .fn()
        .mockResolvedValueOnce("not valid json")
        .mockResolvedValueOnce(JSON.stringify(rawRecord)),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    });
    mockSyncRepo({ findExistingOrderIds: jest.fn().mockResolvedValue(new Set()) });
    mockProductRepo({ resolveLineItemPrices: jest.fn().mockResolvedValue(new Map([["1:null", 5000]])) });
    MockedSyncService.syncOrderRecords.mockResolvedValue([
      { order_id: "order-1", sync_status: "synced", synced_at: new Date() },
    ]);

    const results = await StagingService.processStaged();

    expect(results[0]).toEqual({
      key: "staging/order-1.json",
      order_id: "order-1",
      code: "STAGED_BLOB_CORRUPT",
      message: expect.any(String),
    });
    expect(results[1].order_id).toBe("order-1");
  });

  it("reports STAGED_BLOB_CORRUPT when the blob doesn't match the schema", async () => {
    mockStagingRepo({
      listStagedKeys: jest.fn().mockResolvedValue(["staging/order-1.json"]),
      getObject: jest.fn().mockResolvedValue(JSON.stringify({ order_id: "order-1" })),
      deleteObject: jest.fn(),
    });
    mockSyncRepo({ findExistingOrderIds: jest.fn().mockResolvedValue(new Set()) });

    const results = await StagingService.processStaged();

    expect(results).toEqual([
      { key: "staging/order-1.json", order_id: "order-1", code: "STAGED_BLOB_CORRUPT", message: expect.any(String) },
    ]);
  });

  it("rethrows when listStagedKeys itself fails", async () => {
    mockStagingRepo({ listStagedKeys: jest.fn().mockRejectedValue(new StagingStorageException("r2 down")) });

    await expect(StagingService.processStaged()).rejects.toThrow(StagingStorageException);
  });

  it("rethrows an unmocked/unexpected error rather than swallowing it as a per-key result", async () => {
    mockStagingRepo({
      listStagedKeys: jest.fn().mockResolvedValue(["staging/order-1.json"]),
      getObject: jest.fn().mockRejectedValue(new Error("bug")),
      deleteObject: jest.fn(),
    });
    mockSyncRepo({ findExistingOrderIds: jest.fn().mockResolvedValue(new Set()) });

    await expect(StagingService.processStaged()).rejects.toThrow("bug");
  });
});
