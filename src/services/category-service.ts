import { CategoryRepository } from "@/repository/category-repository";
import { Category, CategoryUpdate } from "@/types/category";
import logger from "@/util/logger";

export class CategoryService {
  static async createCategory(data: Category) {
    const category = await new CategoryRepository().createCategory(data);
    logger.info("Category created: %s (id=%d)", category.name, category.category_id);
    return category;
  }

  static async listCategories(includeProducts: boolean, includeInactive?: boolean) {
    return new CategoryRepository().listCategories(includeProducts, includeInactive);
  }

  static async updateCategory(categoryId: number, data: CategoryUpdate) {
    const category = await new CategoryRepository().updateCategory(categoryId, data);
    logger.info("Category updated: id=%d", categoryId);
    return category;
  }

  static async deactivateCategory(categoryId: number): Promise<void> {
    await new CategoryRepository().deactivateCategory(categoryId);
    logger.info("Category deactivated: id=%d", categoryId);
  }
}
