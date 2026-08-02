import { CategoryRepository } from "@/repository/category-repository";
import { Category, CategoryUpdate } from "@/types/category";

export class CategoryService {
  static async createCategory(data: Category) {
    return new CategoryRepository().createCategory(data);
  }

  static async listCategories(includeProducts: boolean, includeInactive?: boolean) {
    return new CategoryRepository().listCategories(includeProducts, includeInactive);
  }

  static async updateCategory(categoryId: number, data: CategoryUpdate) {
    return new CategoryRepository().updateCategory(categoryId, data);
  }

  static async deactivateCategory(categoryId: number): Promise<void> {
    return new CategoryRepository().deactivateCategory(categoryId);
  }
}
