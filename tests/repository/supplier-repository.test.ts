jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    supplier: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import prisma from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import NotFoundException from "@/exceptions/not-found-exception";
import { SupplierRepository } from "@/repository/supplier-repository";

const db = prisma as unknown as {
  supplier: { create: jest.Mock; findMany: jest.Mock; update: jest.Mock };
};

function notFoundError() {
  return new Prisma.PrismaClientKnownRequestError("not found", { code: "P2025", clientVersion: "test" });
}

describe("SupplierRepository.createSupplier", () => {
  const repo = new SupplierRepository();

  it("creates a supplier, relying on the column's default is_active=true", async () => {
    db.supplier.create.mockResolvedValue({ supplier_id: 1, name: "Acme", is_active: true });

    const result = await repo.createSupplier({ name: "Acme" });

    expect(db.supplier.create).toHaveBeenCalledWith({ data: { name: "Acme" } });
    expect(result).toEqual({ supplier_id: 1, name: "Acme", is_active: true });
  });
});

describe("SupplierRepository.listSuppliers", () => {
  const repo = new SupplierRepository();

  it("excludes inactive suppliers by default", async () => {
    db.supplier.findMany.mockResolvedValue([{ supplier_id: 1, name: "Acme", is_active: true }]);

    const result = await repo.listSuppliers();

    expect(db.supplier.findMany).toHaveBeenCalledWith({ where: { is_active: true } });
    expect(result).toEqual([{ supplier_id: 1, name: "Acme", is_active: true }]);
  });

  it("includes inactive suppliers when includeInactive is true", async () => {
    db.supplier.findMany.mockResolvedValue([{ supplier_id: 2, name: "Old Co", is_active: false }]);

    await repo.listSuppliers(true);

    expect(db.supplier.findMany).toHaveBeenCalledWith({ where: undefined });
  });
});

describe("SupplierRepository.updateSupplier", () => {
  const repo = new SupplierRepository();

  it("throws NotFoundException when the supplier does not exist", async () => {
    db.supplier.update.mockRejectedValue(notFoundError());
    await expect(repo.updateSupplier(999, { name: "New" })).rejects.toThrow(NotFoundException);
  });
});

describe("SupplierRepository.deactivateSupplier", () => {
  const repo = new SupplierRepository();

  it("throws NotFoundException when the supplier does not exist", async () => {
    db.supplier.update.mockRejectedValue(notFoundError());
    await expect(repo.deactivateSupplier(999)).rejects.toThrow(NotFoundException);
  });
});
