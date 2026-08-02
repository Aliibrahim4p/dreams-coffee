jest.mock("@/repository/inventory-item-repository");

import { InventoryItemRepository } from "@/repository/inventory-item-repository";
import { InventoryItemService } from "@/services/inventory-item-service";

const MockedInventoryItemRepository = InventoryItemRepository as jest.MockedClass<
  typeof InventoryItemRepository
>;

function mockRepo(overrides: Partial<Record<string, jest.Mock>>) {
  MockedInventoryItemRepository.mockImplementation(
    () => overrides as unknown as InventoryItemRepository,
  );
}

describe("InventoryItemService", () => {
  it("createInventoryItem delegates to the repository", async () => {
    const createInventoryItem = jest.fn().mockResolvedValue({ item_id: 1 });
    mockRepo({ createInventoryItem });
    const data = { name: "Milk", unit: "ml" as const, count_frequency: "daily" as const };

    await InventoryItemService.createInventoryItem(data);

    expect(createInventoryItem).toHaveBeenCalledWith(data);
  });

  it("listInventoryItems delegates to the repository", async () => {
    const listInventoryItems = jest.fn().mockResolvedValue([]);
    mockRepo({ listInventoryItems });

    await InventoryItemService.listInventoryItems("daily", true, true);

    expect(listInventoryItems).toHaveBeenCalledWith("daily", true, true);
  });

  it("getPackConfigurations delegates to the repository", async () => {
    const getPackConfigurations = jest.fn().mockResolvedValue([]);
    mockRepo({ getPackConfigurations });

    await InventoryItemService.getPackConfigurations(1);

    expect(getPackConfigurations).toHaveBeenCalledWith(1);
  });
});
