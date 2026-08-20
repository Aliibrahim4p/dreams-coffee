jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    category: { findUnique: jest.fn() },
    product: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    recipe: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
    recipeIngredient: { deleteMany: jest.fn(), createMany: jest.fn() },
    sizeModifier: { findUnique: jest.fn() },
    inventoryItem: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import prisma from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import NotFoundException from "@/exceptions/not-found-exception";
import BadRequestException from "@/exceptions/bad-request-exception";
import UniqueException from "@/exceptions/unique-exception";
import { ProductRepository, resolveProductSizes } from "@/repository/product-repository";

const db = prisma as unknown as {
  category: { findUnique: jest.Mock };
  product: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock };
  recipe: { findMany: jest.Mock; create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; findUniqueOrThrow: jest.Mock };
  recipeIngredient: { deleteMany: jest.Mock; createMany: jest.Mock };
  sizeModifier: { findUnique: jest.Mock };
  inventoryItem: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

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

describe("resolveProductSizes", () => {
  it("marks reseller products unavailable with a single null-modifier entry", () => {
    const sizes = resolveProductSizes(
      { type: "reseller", base_price: 10000 as unknown as Prisma.Decimal },
      [{ modifier_id: null, modifier: null }],
    );
    expect(sizes).toEqual([
      {
        modifier_id: null,
        modifier_name: null,
        price_adjustment: 0,
        resolved_price: 10000,
        available: false,
      },
    ]);
  });

  it("resolves recipe_based sizes with price adjustments and marks them available", () => {
    const sizes = resolveProductSizes(
      { type: "recipe_based", base_price: 50000 as unknown as Prisma.Decimal },
      [
        {
          modifier_id: 1,
          modifier: { modifier_id: 1, name: "Large", price_adjustment: 5000 as unknown as Prisma.Decimal },
        },
      ],
    );
    expect(sizes).toEqual([
      {
        modifier_id: 1,
        modifier_name: "Large",
        price_adjustment: 5000,
        resolved_price: 55000,
        available: true,
      },
    ]);
  });
});

describe("ProductRepository.createProduct", () => {
  const repo = new ProductRepository();

  it("creates a product when the category exists", async () => {
    db.category.findUnique.mockResolvedValue({ category_id: 1, name: "Drinks" });
    db.product.create.mockResolvedValue({
      product_id: 1,
      category_id: 1,
      name: "Latte",
      type: "recipe_based",
      base_price: 50000,
      is_active: true,
    });

    const result = await repo.createProduct({
      category_id: 1,
      name: "Latte",
      type: "recipe_based",
      base_price: 50000,
    });

    expect(result).toEqual({
      product_id: 1,
      category_id: 1,
      name: "Latte",
      type: "recipe_based",
      base_price: 50000,
      is_active: true,
    });
  });

  it("throws BadRequestException when category_id does not exist", async () => {
    db.category.findUnique.mockResolvedValue(null);

    await expect(
      repo.createProduct({ category_id: 999, name: "Latte", type: "reseller", base_price: 1 }),
    ).rejects.toThrow(BadRequestException);
    expect(db.product.create).not.toHaveBeenCalled();
  });
});

describe("ProductRepository.updateProduct", () => {
  const repo = new ProductRepository();

  it("throws NotFoundException when the product does not exist", async () => {
    db.product.update.mockRejectedValue(notFoundError());

    await expect(repo.updateProduct(1, { name: "New" })).rejects.toThrow(NotFoundException);
  });
});

describe("ProductRepository.deactivateProduct", () => {
  const repo = new ProductRepository();

  it("throws NotFoundException when the product does not exist", async () => {
    db.product.update.mockRejectedValue(notFoundError());

    await expect(repo.deactivateProduct(1)).rejects.toThrow(NotFoundException);
  });
});

describe("ProductRepository.listCategoryProducts", () => {
  const repo = new ProductRepository();

  it("throws NotFoundException when the category does not exist", async () => {
    db.category.findUnique.mockResolvedValue(null);

    await expect(repo.listCategoryProducts(1)).rejects.toThrow(NotFoundException);
  });
});

describe("ProductRepository.getProductSizes", () => {
  const repo = new ProductRepository();

  it("throws NotFoundException when the product does not exist", async () => {
    db.product.findUnique.mockResolvedValue(null);

    await expect(repo.getProductSizes(1)).rejects.toThrow(NotFoundException);
  });

  it("returns an empty array when no recipes are seeded", async () => {
    db.product.findUnique.mockResolvedValue({
      product_id: 1,
      type: "recipe_based",
      base_price: 50000,
    });
    db.recipe.findMany.mockResolvedValue([]);

    const result = await repo.getProductSizes(1);
    expect(result).toEqual([]);
  });
});

describe("ProductRepository.getProductRecipe", () => {
  const repo = new ProductRepository();

  it("throws NotFoundException when the product does not exist", async () => {
    db.product.findUnique.mockResolvedValue(null);

    await expect(repo.getProductRecipe(1)).rejects.toThrow(NotFoundException);
  });

  it("throws NotFoundException when no recipe is seeded for the product", async () => {
    db.product.findUnique.mockResolvedValue({ product_id: 1, name: "Latte" });
    db.recipe.findMany.mockResolvedValue([]);

    await expect(repo.getProductRecipe(1)).rejects.toThrow(NotFoundException);
  });

  it("returns resolved recipe details when seeded", async () => {
    db.product.findUnique.mockResolvedValue({ product_id: 1, name: "Latte" });
    db.recipe.findMany.mockResolvedValue([
      {
        recipe_id: 10,
        product_id: 1,
        modifier_id: 2,
        modifier: { modifier_id: 2, name: "Large" },
        ingredients: [
          { item_id: 5, quantity: 200, unit: "ml", item: { name: "Milk" } },
        ],
      },
    ]);

    const result = await repo.getProductRecipe(1, 2);

    expect(result).toEqual([
      {
        recipe_id: 10,
        product_id: 1,
        product_name: "Latte",
        modifier_id: 2,
        modifier_name: "Large",
        ingredients: [{ item_id: 5, item_name: "Milk", quantity: 200, unit: "ml" }],
      },
    ]);
    expect(db.recipe.findMany).toHaveBeenCalledWith({
      where: {
        product_id: 1,
        OR: [{ modifier_id: null }, { modifier: { is_active: true } }],
        modifier_id: 2,
      },
      include: { modifier: true, ingredients: { include: { item: true } } },
    });
  });
});

describe("ProductRepository.createRecipe", () => {
  const repo = new ProductRepository();
  const recipeBody = { modifier_id: 1, ingredients: [{ item_id: 5, quantity: 200, unit: "ml" as const }] };

  it("throws NotFoundException when the product does not exist", async () => {
    db.product.findUnique.mockResolvedValue(null);

    await expect(repo.createRecipe(1, recipeBody)).rejects.toThrow(NotFoundException);
  });

  it("throws BadRequestException when a reseller product is given a modifier_id", async () => {
    db.product.findUnique.mockResolvedValue({ product_id: 1, name: "Croissant", type: "reseller" });

    await expect(repo.createRecipe(1, recipeBody)).rejects.toThrow(BadRequestException);
  });

  it("throws BadRequestException when a recipe_based product has no modifier_id", async () => {
    db.product.findUnique.mockResolvedValue({ product_id: 1, name: "Latte", type: "recipe_based" });

    await expect(
      repo.createRecipe(1, { ...recipeBody, modifier_id: null }),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws BadRequestException when modifier_id does not exist", async () => {
    db.product.findUnique.mockResolvedValue({ product_id: 1, name: "Latte", type: "recipe_based" });
    db.sizeModifier.findUnique.mockResolvedValue(null);

    await expect(repo.createRecipe(1, recipeBody)).rejects.toThrow(BadRequestException);
  });

  it("throws BadRequestException when an ingredient's item_id does not exist", async () => {
    db.product.findUnique.mockResolvedValue({ product_id: 1, name: "Latte", type: "recipe_based" });
    db.sizeModifier.findUnique.mockResolvedValue({ modifier_id: 1, name: "Small" });
    db.inventoryItem.findMany.mockResolvedValue([]);

    await expect(repo.createRecipe(1, recipeBody)).rejects.toThrow(BadRequestException);
  });

  it("throws UniqueException when a recipe already exists for this product+modifier", async () => {
    db.product.findUnique.mockResolvedValue({ product_id: 1, name: "Latte", type: "recipe_based" });
    db.sizeModifier.findUnique.mockResolvedValue({ modifier_id: 1, name: "Small" });
    db.inventoryItem.findMany.mockResolvedValue([{ item_id: 5 }]);
    db.recipe.create.mockRejectedValue(uniqueError(["product_id", "modifier_id"]));

    await expect(repo.createRecipe(1, recipeBody)).rejects.toThrow(UniqueException);
  });

  it("creates and returns the mapped recipe", async () => {
    db.product.findUnique.mockResolvedValue({ product_id: 1, name: "Latte", type: "recipe_based" });
    db.sizeModifier.findUnique.mockResolvedValue({ modifier_id: 1, name: "Small" });
    db.inventoryItem.findMany.mockResolvedValue([{ item_id: 5 }]);
    db.recipe.create.mockResolvedValue({
      recipe_id: 10,
      product_id: 1,
      modifier_id: 1,
      modifier: { modifier_id: 1, name: "Small" },
      ingredients: [{ item_id: 5, quantity: 200, unit: "ml", item: { name: "Milk" } }],
    });

    const result = await repo.createRecipe(1, recipeBody);

    expect(result).toEqual({
      recipe_id: 10,
      product_id: 1,
      product_name: "Latte",
      modifier_id: 1,
      modifier_name: "Small",
      ingredients: [{ item_id: 5, item_name: "Milk", quantity: 200, unit: "ml" }],
    });
  });

  it("allows a reseller product with modifier_id null", async () => {
    db.product.findUnique.mockResolvedValue({ product_id: 2, name: "Croissant", type: "reseller" });
    db.inventoryItem.findMany.mockResolvedValue([{ item_id: 9 }]);
    db.recipe.create.mockResolvedValue({
      recipe_id: 11,
      product_id: 2,
      modifier_id: null,
      modifier: null,
      ingredients: [{ item_id: 9, quantity: 1, unit: "piece", item: { name: "Croissant Unit" } }],
    });

    const result = await repo.createRecipe(2, {
      modifier_id: null,
      ingredients: [{ item_id: 9, quantity: 1, unit: "piece" }],
    });

    expect(db.sizeModifier.findUnique).not.toHaveBeenCalled();
    expect(result.modifier_id).toBeNull();
  });
});

describe("ProductRepository.updateRecipe", () => {
  const repo = new ProductRepository();
  const recipeRow = {
    recipe_id: 10,
    product_id: 1,
    modifier_id: 1,
    product: { product_id: 1, name: "Latte", type: "recipe_based" },
  };

  beforeEach(() => {
    db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        recipe: { update: db.recipe.update, findUniqueOrThrow: db.recipe.findUniqueOrThrow },
        recipeIngredient: { deleteMany: db.recipeIngredient.deleteMany, createMany: db.recipeIngredient.createMany },
      }),
    );
  });

  it("throws NotFoundException when the recipe does not exist", async () => {
    db.recipe.findUnique.mockResolvedValue(null);

    await expect(
      repo.updateRecipe(1, 10, { ingredients: [{ item_id: 5, quantity: 1, unit: "ml" }] }),
    ).rejects.toThrow(NotFoundException);
  });

  it("throws NotFoundException when the recipe belongs to a different product", async () => {
    db.recipe.findUnique.mockResolvedValue({ ...recipeRow, product_id: 2 });

    await expect(
      repo.updateRecipe(1, 10, { ingredients: [{ item_id: 5, quantity: 1, unit: "ml" }] }),
    ).rejects.toThrow(NotFoundException);
  });

  it("throws BadRequestException when reassigning a modifier_id to a reseller product's recipe", async () => {
    db.recipe.findUnique.mockResolvedValue({
      ...recipeRow,
      modifier_id: null,
      product: { product_id: 1, name: "Croissant", type: "reseller" },
    });

    await expect(repo.updateRecipe(1, 10, { modifier_id: 2 })).rejects.toThrow(BadRequestException);
  });

  it("throws BadRequestException when clearing modifier_id on a recipe_based product's recipe", async () => {
    db.recipe.findUnique.mockResolvedValue(recipeRow);

    await expect(repo.updateRecipe(1, 10, { modifier_id: null })).rejects.toThrow(BadRequestException);
  });

  it("throws BadRequestException when the new modifier_id does not exist", async () => {
    db.recipe.findUnique.mockResolvedValue(recipeRow);
    db.sizeModifier.findUnique.mockResolvedValue(null);

    await expect(repo.updateRecipe(1, 10, { modifier_id: 2 })).rejects.toThrow(BadRequestException);
  });

  it("throws BadRequestException when an ingredient's item_id does not exist", async () => {
    db.recipe.findUnique.mockResolvedValue(recipeRow);
    db.inventoryItem.findMany.mockResolvedValue([]);

    await expect(
      repo.updateRecipe(1, 10, { ingredients: [{ item_id: 5, quantity: 1, unit: "ml" }] }),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws UniqueException when reassigning modifier_id collides with an existing recipe", async () => {
    db.recipe.findUnique.mockResolvedValue(recipeRow);
    db.sizeModifier.findUnique.mockResolvedValue({ modifier_id: 2, name: "Medium" });
    db.recipe.update.mockRejectedValue(uniqueError(["product_id", "modifier_id"]));

    await expect(repo.updateRecipe(1, 10, { modifier_id: 2 })).rejects.toThrow(UniqueException);
  });

  it("replaces the ingredient list and returns the mapped recipe", async () => {
    db.recipe.findUnique.mockResolvedValue(recipeRow);
    db.inventoryItem.findMany.mockResolvedValue([{ item_id: 6 }]);
    db.recipe.findUniqueOrThrow.mockResolvedValue({
      recipe_id: 10,
      product_id: 1,
      modifier_id: 1,
      modifier: { modifier_id: 1, name: "Small" },
      ingredients: [{ item_id: 6, quantity: 300, unit: "ml", item: { name: "Oat Milk" } }],
    });

    const result = await repo.updateRecipe(1, 10, {
      ingredients: [{ item_id: 6, quantity: 300, unit: "ml" }],
    });

    expect(db.recipeIngredient.deleteMany).toHaveBeenCalledWith({ where: { recipe_id: 10 } });
    expect(db.recipeIngredient.createMany).toHaveBeenCalledWith({
      data: [{ recipe_id: 10, item_id: 6, quantity: 300, unit: "ml" }],
    });
    expect(db.recipe.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      recipe_id: 10,
      product_id: 1,
      product_name: "Latte",
      modifier_id: 1,
      modifier_name: "Small",
      ingredients: [{ item_id: 6, item_name: "Oat Milk", quantity: 300, unit: "ml" }],
    });
  });

  it("updates modifier_id only, leaving ingredients untouched", async () => {
    db.recipe.findUnique.mockResolvedValue(recipeRow);
    db.sizeModifier.findUnique.mockResolvedValue({ modifier_id: 2, name: "Medium" });
    db.recipe.update.mockResolvedValue({});
    db.recipe.findUniqueOrThrow.mockResolvedValue({
      recipe_id: 10,
      product_id: 1,
      modifier_id: 2,
      modifier: { modifier_id: 2, name: "Medium" },
      ingredients: [],
    });

    const result = await repo.updateRecipe(1, 10, { modifier_id: 2 });

    expect(db.recipe.update).toHaveBeenCalledWith({ where: { recipe_id: 10 }, data: { modifier_id: 2 } });
    expect(db.recipeIngredient.deleteMany).not.toHaveBeenCalled();
    expect(db.recipeIngredient.createMany).not.toHaveBeenCalled();
    expect(result.modifier_id).toBe(2);
  });
});
