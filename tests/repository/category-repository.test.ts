jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    category: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import prisma from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import UniqueException from "@/exceptions/unique-exception";
import NotFoundException from "@/exceptions/not-found-exception";
import { CategoryRepository } from "@/repository/category-repository";

const mockedCreate = prisma.category.create as jest.Mock;
const mockedFindMany = prisma.category.findMany as jest.Mock;
const mockedUpdate = prisma.category.update as jest.Mock;

function notFoundError() {
  return new Prisma.PrismaClientKnownRequestError("not found", {
    code: "P2025",
    clientVersion: "test",
  });
}

function uniqueError(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError("unique violation", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

describe("CategoryRepository.createCategory", () => {
  const repo = new CategoryRepository();

  it("returns the same mapCategory shape as every other method in this file", async () => {
    mockedCreate.mockResolvedValue({
      category_id: 1,
      name: "Coffee",
      is_active: true,
    });

    const result = await repo.createCategory({ name: "Coffee" });

    expect(result).toEqual({ category_id: 1, name: "Coffee", is_active: true });
    expect(mockedCreate).toHaveBeenCalledWith({ data: { name: "Coffee" } });
  });

  it("throws UniqueException when the name unique constraint fails", async () => {
    mockedCreate.mockRejectedValue(uniqueError(["name"]));

    await expect(repo.createCategory({ name: "Coffee" })).rejects.toThrow(
      UniqueException,
    );
  });

  it("rethrows unrelated errors unchanged", async () => {
    mockedCreate.mockRejectedValue(new Error("connection refused"));

    await expect(repo.createCategory({ name: "Coffee" })).rejects.toThrow(
      "connection refused",
    );
  });

  it("does not wrap non-Error rejections", async () => {
    mockedCreate.mockRejectedValue("boom");

    await expect(repo.createCategory({ name: "Coffee" })).rejects.toBe("boom");
  });
});

describe("CategoryRepository.listCategories", () => {
  const repo = new CategoryRepository();

  it("returns plain categories when includeProducts is false, excluding inactive by default", async () => {
    mockedFindMany.mockResolvedValue([
      { category_id: 1, name: "Coffee", is_active: true },
    ]);

    const result = await repo.listCategories(false);

    expect(result).toEqual([
      { category_id: 1, name: "Coffee", is_active: true },
    ]);
    expect(mockedFindMany).toHaveBeenCalledWith({ where: { is_active: true } });
  });

  it("includes inactive categories when includeInactive is true", async () => {
    mockedFindMany.mockResolvedValue([]);

    await repo.listCategories(false, true);

    expect(mockedFindMany).toHaveBeenCalledWith({ where: undefined });
  });

  it("includes each product's resolved sizes when includeProducts is true", async () => {
    mockedFindMany.mockResolvedValue([
      {
        category_id: 1,
        name: "Coffee",
        is_active: true,
        products: [
          {
            product_id: 1,
            category_id: 1,
            name: "Latte",
            type: "reseller",
            base_price: 1000,
            is_active: true,
            recipes: [{ modifier_id: null, modifier: null }],
          },
        ],
      },
    ]);

    const result = await repo.listCategories(true);

    expect(result).toEqual([
      {
        category_id: 1,
        name: "Coffee",
        is_active: true,
        products: [
          {
            product_id: 1,
            category_id: 1,
            name: "Latte",
            type: "reseller",
            base_price: 1000,
            is_active: true,
            sizes: [
              {
                modifier_id: null,
                modifier_name: null,
                price_adjustment: 0,
                resolved_price: 1000,
                available: false,
              },
            ],
          },
        ],
      },
    ]);
  });
});

describe("CategoryRepository.updateCategory", () => {
  const repo = new CategoryRepository();

  it("returns the renamed category", async () => {
    mockedUpdate.mockResolvedValue({
      category_id: 1,
      name: "New Name",
      is_active: true,
    });

    const result = await repo.updateCategory(1, { name: "New Name" });

    expect(result).toEqual({
      category_id: 1,
      name: "New Name",
      is_active: true,
    });
  });

  it("throws NotFoundException when the category does not exist", async () => {
    mockedUpdate.mockRejectedValue(notFoundError());

    await expect(
      repo.updateCategory(999, { name: "New Name" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("throws UniqueException when the new name is already taken", async () => {
    mockedUpdate.mockRejectedValue(uniqueError(["name"]));

    await expect(repo.updateCategory(1, { name: "Taken" })).rejects.toThrow(
      UniqueException,
    );
  });
});

describe("CategoryRepository.deactivateCategory", () => {
  const repo = new CategoryRepository();

  it("throws NotFoundException when the category does not exist", async () => {
    mockedUpdate.mockRejectedValue(notFoundError());

    await expect(repo.deactivateCategory(999)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("resolves when the category is deactivated", async () => {
    mockedUpdate.mockResolvedValue({
      category_id: 1,
      name: "Coffee",
      is_active: false,
    });

    await expect(repo.deactivateCategory(1)).resolves.toBeUndefined();
    expect(mockedUpdate).toHaveBeenCalledWith({
      where: { category_id: 1 },
      data: { is_active: false },
    });
  });
});
