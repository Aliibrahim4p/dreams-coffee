import UniqueException from "@/exceptions/unique-exception";
import NotFoundException from "@/exceptions/not-found-exception";
import prisma from "@/lib/db";
import { isNotFoundError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { mapProduct, resolveProductSizes } from "@/repository/product-repository";
import { Category, CategoryUpdate } from "@/types/category";
import logger from "@/util/logger";

function mapCategory(category: { category_id: number; name: string; is_active: boolean }) {
  return {
    category_id: category.category_id,
    name: category.name,
    is_active: category.is_active,
  };
}

export class CategoryRepository {
  async createCategory(data: Category) {
    try {
      const category = await prisma.category.create({
        data: {
          name: data.name,
        },
      });
      return mapCategory(category);
    } catch (error) {
      if (isUniqueConstraintError(error, "name")) {
        throw new UniqueException("Category name must be unique");
      }
      logger.error("Failed to create category name=%s: %s", data.name, error);
      throw error;
    }
  }

  async listCategories(includeProducts: boolean, includeInactive?: boolean) {
    const where = includeInactive ? undefined : { is_active: true };

    if (!includeProducts) {
      const categories = await prisma.category.findMany({ where });
      return categories.map(mapCategory);
    }

    const activeRecipes = { OR: [{ modifier_id: null }, { modifier: { is_active: true } }] };
    const categories = await prisma.category.findMany({
      where,
      include: {
        products: {
          where: includeInactive ? undefined : { is_active: true },
          include: {
            recipes: {
              where: includeInactive ? undefined : activeRecipes,
              include: { modifier: true },
            },
          },
        },
      },
    });
    return categories.map((category) => ({
      ...mapCategory(category),
      products: category.products.map((product) => ({
        ...mapProduct(product),
        sizes: resolveProductSizes(product, product.recipes),
      })),
    }));
  }

  async updateCategory(categoryId: number, data: CategoryUpdate) {
    try {
      const category = await prisma.category.update({
        where: { category_id: categoryId },
        data,
      });
      return mapCategory(category);
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new NotFoundException("Category not found");
      }
      if (isUniqueConstraintError(error, "name")) {
        throw new UniqueException("Category name already taken");
      }
      logger.error("Failed to update category_id=%d: %s", categoryId, error);
      throw error;
    }
  }

  async deactivateCategory(categoryId: number): Promise<void> {
    try {
      await prisma.category.update({
        where: { category_id: categoryId },
        data: { is_active: false },
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new NotFoundException("Category not found");
      }
      logger.error("Failed to deactivate category_id=%d: %s", categoryId, error);
      throw error;
    }
  }
}
