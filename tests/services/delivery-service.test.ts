jest.mock("@/repository/delivery-repository");

import { DeliveryRepository } from "@/repository/delivery-repository";
import { DeliveryService } from "@/services/delivery-service";

const MockedRepo = DeliveryRepository as jest.MockedClass<typeof DeliveryRepository>;

function mockRepo(overrides: Partial<Record<string, jest.Mock>>) {
  MockedRepo.mockImplementation(() => overrides as unknown as DeliveryRepository);
}

describe("DeliveryService", () => {
  it("createDelivery delegates to the repository", async () => {
    const createDelivery = jest.fn().mockResolvedValue({ delivery_id: "1" });
    mockRepo({ createDelivery });
    const data = {
      supplier_id: 1,
      line_items: [{ item_id: 1, config_id: 1, qty_received: 2, total_cost: 2000 }],
    };

    await DeliveryService.createDelivery(data, 1);

    expect(createDelivery).toHaveBeenCalledWith(data, 1);
  });

  it("listDeliveries delegates to the repository", async () => {
    const listDeliveries = jest.fn().mockResolvedValue([]);
    mockRepo({ listDeliveries });
    const date = new Date("2026-07-31");

    await DeliveryService.listDeliveries(date, 1);

    expect(listDeliveries).toHaveBeenCalledWith(date, 1);
  });

  it("getDelivery delegates to the repository", async () => {
    const getDelivery = jest.fn().mockResolvedValue({ delivery_id: "1" });
    mockRepo({ getDelivery });

    await DeliveryService.getDelivery("1");

    expect(getDelivery).toHaveBeenCalledWith("1");
  });
});
