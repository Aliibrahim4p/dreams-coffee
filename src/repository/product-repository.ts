import prisma from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import NotFoundException from "@/exceptions/not-found-exception";
import BadRequestException from "@/exceptions/bad-request-exception";
import UniqueException from "@/exceptions/unique-exception";
import { isNotFoundError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { ProductCreate, ProductUpdate } from "@/types/product";
import { RecipeCreate, RecipeUpdate } from "@/types/recipe";

export type ProductSizeOption = {
  modifier_id: number | null;
  modifier_name: string | null;
  price_adjustment: number;
  resolved_price: number;
  available: boolean;
};

type RecipeWithModifier = {
  modifier_id: number | null;
  modifier: { modifier_id: number; name: string; price_adjustment: Prisma.Decimal } | null;
};

export function resolveProductSizes(
  product: { type: string; base_price: Prisma.Decimal },
  recipes: RecipeWithModifier[],
): ProductSizeOption[] {
  return recipes.map((recipe) => {
    const priceAdjustment = recipe.modifier ? Number(recipe.modifier.price_adjustment) : 0;
    return {
      modifier_id: recipe.modifier ? recipe.modifier.modifier_id : null,
      modifier_name: recipe.modifier ? recipe.modifier.name : null,
      price_adjustment: priceAdjustment,
      resolved_price: Number(product.base_price) + priceAdjustment,
      available: product.type !== "reseller",
    };
  });
}

type ProductRow = {
  product_id: number;
  category_id: number;
  name: string;
  type: string;
  base_price: Prisma.Decimal;
  is_active: boolean;
};

export function mapProduct(product: ProductRow) {
  return {
    product_id: product.product_id,
    category_id: product.category_id,
    name: product.name,
    type: product.type,
    base_price: Number(product.base_price),
    is_active: product.is_active,
  };
}

type RecipeWithIngredients = {
  recipe_id: number;
  product_id: number;
  modifier_id: number | null;
  modifier: { name: string } | null;
  ingredients: Array<{
    item_id: number;
    quantity: Prisma.Decimal;
    unit: string;
    item: { name: string };
  }>;
};

function mapRecipe(recipe: RecipeWithIngredients, productName: string) {
  return {
    recipe_id: recipe.recipe_id,
    product_id: recipe.product_id,
    product_name: productName,
    modifier_id: recipe.modifier_id,
    modifier_name: recipe.modifier ? recipe.modifier.name : null,
    ingredients: recipe.ingredients.map((ingredient) => ({
      item_id: ingredient.item_id,
      item_name: ingredient.item.name,
      quantity: Number(ingredient.quantity),
      unit: ingredient.unit,
    })),
  };
}

export class ProductRepository {
  async createProduct(data: ProductCreate) {
    const category = await prisma.category.findUnique({
      where: { category_id: data.category_id },
    });
    if (!category) {
      throw new BadRequestException("Invalid category_id");
    }
    const product = await prisma.product.create({ data });
    return mapProduct(product);
  }

  async updateProduct(productId: number, data: ProductUpdate) {
    if (data.category_id !== undefined) {
      const category = await prisma.category.findUnique({
        where: { category_id: data.category_id },
      });
      if (!category) {
        throw new BadRequestException("Invalid category_id");
      }
    }
    try {
      const product = await prisma.product.update({
        where: { product_id: productId },
        data,
      });
      return mapProduct(product);
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new NotFoundException("Product not found");
      }
      throw error;
    }
  }

  async deactivateProduct(productId: number): Promise<void> {
    try {
      await prisma.product.update({
        where: { product_id: productId },
        data: { is_active: false },
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new NotFoundException("Product not found");
      }
      throw error;
    }
  }

  async listCategoryProducts(categoryId: number, includeInactive?: boolean) {
    const category = await prisma.category.findUnique({
      where: { category_id: categoryId },
    });
    if (!category) {
      throw new NotFoundException("Category not found");
    }
    const products = await prisma.product.findMany({
      where: {
        category_id: categoryId,
        ...(includeInactive ? {} : { is_active: true }),
      },
    });
    return products.map(mapProduct);
  }

  async getProductSizes(productId: number): Promise<ProductSizeOption[]> {
    const product = await prisma.product.findUnique({ where: { product_id: productId } });
    if (!product) {
      throw new NotFoundException("Product not found");
    }
    const recipes = await prisma.recipe.findMany({
      where: { product_id: productId, OR: [{ modifier_id: null }, { modifier: { is_active: true } }] },
      include: { modifier: true },
    });
    return resolveProductSizes(product, recipes);
  }

  async getProductRecipe(productId: number, modifierId?: number) {
    const product = await prisma.product.findUnique({ where: { product_id: productId } });
    if (!product) {
      throw new NotFoundException("Product not found");
    }
    const recipes = await prisma.recipe.findMany({
      where: {
        product_id: productId,
        OR: [{ modifier_id: null }, { modifier: { is_active: true } }],
        ...(modifierId !== undefined ? { modifier_id: modifierId } : {}),
      },
      include: { modifier: true, ingredients: { include: { item: true } } },
    });
    if (recipes.length === 0) {
      throw new NotFoundException("No recipe seeded for this product");
    }
    return recipes.map((recipe) => mapRecipe(recipe, product.name));
  }

  async createRecipe(productId: number, data: RecipeCreate) {
    const product = await prisma.product.findUnique({ where: { product_id: productId } });
    if (!product) {
      throw new NotFoundException("Product not found");
    }
    if (product.type === "reseller" && data.modifier_id !== null) {
      throw new BadRequestException("Reseller products cannot have a modifier_id");
    }
    if (product.type !== "reseller" && data.modifier_id === null) {
      throw new BadRequestException("modifier_id is required for recipe_based products");
    }

    if (data.modifier_id !== null) {
      const modifier = await prisma.sizeModifier.findUnique({
        where: { modifier_id: data.modifier_id },
      });
      if (!modifier) {
        throw new BadRequestException("Invalid modifier_id");
      }
    }

    const items = await prisma.inventoryItem.findMany({
      where: { item_id: { in: data.ingredients.map((ingredient) => ingredient.item_id) } },
    });
    const itemIds = new Set(items.map((item) => item.item_id));
    for (const ingredient of data.ingredients) {
      if (!itemIds.has(ingredient.item_id)) {
        throw new BadRequestException("item_id not in the predefined list");
      }
    }

    try {
      const recipe = await prisma.recipe.create({
        data: {
          product_id: productId,
          modifier_id: data.modifier_id,
          ingredients: {
            create: data.ingredients.map((ingredient) => ({
              item_id: ingredient.item_id,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
            })),
          },
        },
        include: { modifier: true, ingredients: { include: { item: true } } },
      });
      return mapRecipe(recipe, product.name);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        // @@unique([product_id, modifier_id])
        throw new UniqueException("A recipe already exists for this product and size");
      }
      throw error;
    }
  }

  async updateRecipe(productId: number, recipeId: number, data: RecipeUpdate) {
    const recipe = await prisma.recipe.findUnique({
      where: { recipe_id: recipeId },
      include: { product: true },
    });
    if (!recipe || recipe.product_id !== productId) {
      throw new NotFoundException("Recipe not found");
    }

    const nextModifierId = data.modifier_id !== undefined ? data.modifier_id : recipe.modifier_id;
    if (recipe.product.type === "reseller" && nextModifierId !== null) {
      throw new BadRequestException("Reseller products cannot have a modifier_id");
    }
    if (recipe.product.type !== "reseller" && nextModifierId === null) {
      throw new BadRequestException("modifier_id is required for recipe_based products");
    }
    if (data.modifier_id !== undefined && data.modifier_id !== null) {
      const modifier = await prisma.sizeModifier.findUnique({
        where: { modifier_id: data.modifier_id },
      });
      if (!modifier) {
        throw new BadRequestException("Invalid modifier_id");
      }
    }

    if (data.ingredients) {
      const items = await prisma.inventoryItem.findMany({
        where: { item_id: { in: data.ingredients.map((ingredient) => ingredient.item_id) } },
      });
      const itemIds = new Set(items.map((item) => item.item_id));
      for (const ingredient of data.ingredients) {
        if (!itemIds.has(ingredient.item_id)) {
          throw new BadRequestException("item_id not in the predefined list");
        }
      }
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        if (data.modifier_id !== undefined) {
          await tx.recipe.update({ where: { recipe_id: recipeId }, data: { modifier_id: data.modifier_id } });
        }
        if (data.ingredients) {
          await tx.recipeIngredient.deleteMany({ where: { recipe_id: recipeId } });
          await tx.recipeIngredient.createMany({
            data: data.ingredients.map((ingredient) => ({
              recipe_id: recipeId,
              item_id: ingredient.item_id,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
            })),
          });
        }
        return tx.recipe.findUniqueOrThrow({
          where: { recipe_id: recipeId },
          include: { modifier: true, ingredients: { include: { item: true } } },
        });
      });

      return mapRecipe(updated, recipe.product.name);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new UniqueException("A recipe already exists for this product and size");
      }
      throw error;
    }
  }
}
