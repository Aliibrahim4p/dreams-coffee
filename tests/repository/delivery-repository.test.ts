jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    supplier: { findUnique: jest.fn() },
    manager: { findUnique: jest.fn() },
    packConfiguration: { findMany: jest.fn() },
    delivery: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    inventoryItem: { update: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import prisma from "@/lib/db";
import BadRequestException from "@/exceptions/bad-request-exception";
import NotFoundException from "@/exceptions/not-found-exception";
import { DeliveryRepository } from "@/repository/delivery-repository";

const db = prisma as unknown as {
  supplier: { findUnique: jest.Mock };
  manager: { findUnique: jest.Mock };
  packConfiguration: { findMany: jest.Mock };
  delivery: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
  inventoryItem: { update: jest.Mock };
  $transaction: jest.Mock;
};

const managerRow = { manager_id: 2, username: "jdoe" };

const config = { config_id: 1, item_id: 1, pack_name: "box", base_unit_qty: 12 };

const deliveryRow = {
  delivery_id: "d1",
  manager_id: 2,
  supplier_id: 1,
  date_received: new Date("2026-07-31"),
  notes: null,
  sync_status: "pending",
  synced_at: null,
  supplier: { name: "Acme" },
  line_items: [
    {
      item_id: 1,
      config_id: 1,
      qty_received: 2,
      cost_per_unit: 5000,
      item: { name: "Milk" },
      config: { pack_name: "box", base_unit_qty: 12 },
    },
  ],
};

const validData = {
  supplier_id: 1,
  line_items: [{ item_id: 1, config_id: 1, qty_received: 2, total_cost: 10000 }],
};

describe("DeliveryRepository.createDelivery", () => {
  const repo = new DeliveryRepository();

  beforeEach(() => {
    db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        delivery: { create: db.delivery.create },
        inventoryItem: { update: db.inventoryItem.update },
      }),
    );
  });

  it("throws BadRequestException when the supplier does not exist", async () => {
    db.supplier.findUnique.mockResolvedValue(null);

    await expect(repo.createDelivery(validData, 2)).rejects.toThrow(BadRequestException);
    expect(db.manager.findUnique).not.toHaveBeenCalled();
  });

  it("throws BadRequestException when manager_id does not exist", async () => {
    db.supplier.findUnique.mockResolvedValue({ supplier_id: 1, name: "Acme" });
    db.manager.findUnique.mockResolvedValue(null);

    await expect(repo.createDelivery(validData, 2)).rejects.toThrow(BadRequestException);
    expect(db.packConfiguration.findMany).not.toHaveBeenCalled();
  });

  it("throws BadRequestException when config_id does not belong to item_id", async () => {
    db.supplier.findUnique.mockResolvedValue({ supplier_id: 1, name: "Acme" });
    db.manager.findUnique.mockResolvedValue(managerRow);
    db.packConfiguration.findMany.mockResolvedValue([{ ...config, item_id: 999 }]);

    await expect(repo.createDelivery(validData, 2)).rejects.toThrow(BadRequestException);
  });

  it("throws BadRequestException when config_id is unknown", async () => {
    db.supplier.findUnique.mockResolvedValue({ supplier_id: 1, name: "Acme" });
    db.manager.findUnique.mockResolvedValue(managerRow);
    db.packConfiguration.findMany.mockResolvedValue([]);

    await expect(repo.createDelivery(validData, 2)).rejects.toThrow(BadRequestException);
  });

  it("commits the delivery and increments stock by qty_received * base_unit_qty", async () => {
    db.supplier.findUnique.mockResolvedValue({ supplier_id: 1, name: "Acme" });
    db.manager.findUnique.mockResolvedValue(managerRow);
    db.packConfiguration.findMany.mockResolvedValue([config]);
    db.delivery.create.mockResolvedValue(deliveryRow);

    const result = await repo.createDelivery(validData, 2);

    expect(db.delivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          line_items: {
            create: [
              expect.objectContaining({
                item_id: 1,
                config_id: 1,
                qty_received: 2,
                cost_per_unit: 5000, // total_cost (10000) / qty_received (2)
              }),
            ],
          },
        }),
      }),
    );
    expect(db.inventoryItem.update).toHaveBeenCalledWith({
      where: { item_id: 1 },
      data: { current_stock: { increment: 24 } },
    });
    expect(result.line_items[0]).toEqual({
      item_id: 1,
      item_name: "Milk",
      config_id: 1,
      pack_name: "box",
      qty_received: 2,
      base_units_added: 24,
      cost_per_unit: 5000,
    });
    expect(result.supplier_name).toBe("Acme");
  });
});

describe("DeliveryRepository.getDelivery", () => {
  const repo = new DeliveryRepository();

  it("throws NotFoundException when the delivery does not exist", async () => {
    db.delivery.findUnique.mockResolvedValue(null);
    await expect(repo.getDelivery("missing")).rejects.toThrow(NotFoundException);
  });

  it("returns the mapped delivery", async () => {
    db.delivery.findUnique.mockResolvedValue(deliveryRow);
    const result = await repo.getDelivery("d1");
    expect(result.delivery_id).toBe("d1");
  });
});

describe("DeliveryRepository.listDeliveries", () => {
  const repo = new DeliveryRepository();

  it("filters by date_received and supplier_id when provided", async () => {
    db.delivery.findMany.mockResolvedValue([deliveryRow]);

    await repo.listDeliveries(new Date("2026-07-31"), 1);

    expect(db.delivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { date_received: new Date("2026-07-31"), supplier_id: 1 },
      }),
    );
  });
});
