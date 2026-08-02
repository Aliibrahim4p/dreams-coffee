jest.mock("@/repository/inventory-count-entry-repository");

import { InventoryCountEntryRepository } from "@/repository/inventory-count-entry-repository";
import { InventoryCountEntryService } from "@/services/inventory-count-entry-service";

const MockedRepo = InventoryCountEntryRepository as jest.MockedClass<
  typeof InventoryCountEntryRepository
>;

function mockRepo(overrides: Partial<Record<string, jest.Mock>>) {
  MockedRepo.mockImplementation(() => overrides as unknown as InventoryCountEntryRepository);
}

describe("InventoryCountEntryService", () => {
  it("createEntry delegates to the repository", async () => {
    const createEntry = jest.fn().mockResolvedValue({ count_id: "1" });
    mockRepo({ createEntry });
    const data = { item_id: 1, physical_count: 10 };

    await InventoryCountEntryService.createEntry(data, 2);

    expect(createEntry).toHaveBeenCalledWith(data, 2);
  });

  it("listEntries delegates to the repository", async () => {
    const listEntries = jest.fn().mockResolvedValue([]);
    mockRepo({ listEntries });
    const date = new Date("2026-07-31");

    await InventoryCountEntryService.listEntries(date, 1);

    expect(listEntries).toHaveBeenCalledWith(date, 1);
  });

  it("getEntry delegates to the repository", async () => {
    const getEntry = jest.fn().mockResolvedValue({ count_id: "1" });
    mockRepo({ getEntry });

    await InventoryCountEntryService.getEntry("1");

    expect(getEntry).toHaveBeenCalledWith("1");
  });
});
