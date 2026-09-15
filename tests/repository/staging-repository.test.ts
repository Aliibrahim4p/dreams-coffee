const mockSend = jest.fn();

jest.mock("@/lib/r2", () => ({
  __esModule: true,
  default: { send: (...args: unknown[]) => mockSend(...args) },
  R2_BUCKET: "test-bucket",
}));

import { StagingRepository } from "@/repository/staging-repository";
import StagingStorageException from "@/exceptions/staging-storage-exception";

describe("StagingRepository", () => {
  const repo = new StagingRepository();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("putOrder", () => {
    it("uploads the body under staging/{orderId}.json and returns the key", async () => {
      mockSend.mockResolvedValue({});

      const key = await repo.putOrder("order-1", '{"order_id":"order-1"}');

      expect(key).toBe("staging/order-1.json");
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: "test-bucket",
            Key: "staging/order-1.json",
            Body: '{"order_id":"order-1"}',
            ContentType: "application/json",
          },
        }),
      );
    });

    it("wraps an SDK failure as StagingStorageException", async () => {
      mockSend.mockRejectedValue(new Error("network error"));

      await expect(repo.putOrder("order-1", "{}")).rejects.toThrow(StagingStorageException);
    });
  });

  describe("listStagedKeys", () => {
    it("lists keys under the staging/ prefix", async () => {
      mockSend.mockResolvedValue({
        Contents: [{ Key: "staging/order-1.json" }, { Key: "staging/order-2.json" }],
        IsTruncated: false,
      });

      const keys = await repo.listStagedKeys();

      expect(keys).toEqual(["staging/order-1.json", "staging/order-2.json"]);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ input: { Bucket: "test-bucket", Prefix: "staging/", ContinuationToken: undefined } }),
      );
    });

    it("pages past the 1000-key limit via ContinuationToken", async () => {
      mockSend
        .mockResolvedValueOnce({
          Contents: [{ Key: "staging/order-1.json" }],
          IsTruncated: true,
          NextContinuationToken: "token-2",
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: "staging/order-2.json" }],
          IsTruncated: false,
        });

      const keys = await repo.listStagedKeys();

      expect(keys).toEqual(["staging/order-1.json", "staging/order-2.json"]);
      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(mockSend.mock.calls[1][0].input.ContinuationToken).toBe("token-2");
    });

    it("returns an empty array when nothing is staged", async () => {
      mockSend.mockResolvedValue({ Contents: undefined, IsTruncated: false });

      expect(await repo.listStagedKeys()).toEqual([]);
    });

    it("wraps an SDK failure as StagingStorageException", async () => {
      mockSend.mockRejectedValue(new Error("network error"));

      await expect(repo.listStagedKeys()).rejects.toThrow(StagingStorageException);
    });
  });

  describe("getObject", () => {
    it("returns the object body as a string", async () => {
      mockSend.mockResolvedValue({ Body: { transformToString: jest.fn().mockResolvedValue('{"order_id":"o1"}') } });

      const body = await repo.getObject("staging/order-1.json");

      expect(body).toBe('{"order_id":"o1"}');
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ input: { Bucket: "test-bucket", Key: "staging/order-1.json" } }),
      );
    });

    it("wraps an SDK failure as StagingStorageException", async () => {
      mockSend.mockRejectedValue(new Error("network error"));

      await expect(repo.getObject("staging/order-1.json")).rejects.toThrow(StagingStorageException);
    });
  });

  describe("deleteObject", () => {
    it("deletes the given key", async () => {
      mockSend.mockResolvedValue({});

      await repo.deleteObject("staging/order-1.json");

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ input: { Bucket: "test-bucket", Key: "staging/order-1.json" } }),
      );
    });

    it("wraps an SDK failure as StagingStorageException", async () => {
      mockSend.mockRejectedValue(new Error("network error"));

      await expect(repo.deleteObject("staging/order-1.json")).rejects.toThrow(StagingStorageException);
    });
  });
});
