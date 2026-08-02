import { ProductRepository } from "@/repository/product-repository";
import { ProductCreate, ProductUpdate } from "@/types/product";
import { RecipeCreate, RecipeUpdate } from "@/types/recipe";

export class ProductService {
  static async createProduct(data: ProductCreate) {
    return new ProductRepository().createProduct(data);
  }

  static async updateProduct(productId: number, data: ProductUpdate) {
    return new ProductRepository().updateProduct(productId, data);
  }

  static async deactivateProduct(productId: number): Promise<void> {
    return new ProductRepository().deactivateProduct(productId);
  }

  static async listCategoryProducts(categoryId: number, includeInactive?: boolean) {
    return new ProductRepository().listCategoryProducts(categoryId, includeInactive);
  }

  static async getProductSizes(productId: number) {
    return new ProductRepository().getProductSizes(productId);
  }

  static async getProductRecipe(productId: number, modifierId?: number) {
    return new ProductRepository().getProductRecipe(productId, modifierId);
  }

  static async createRecipe(productId: number, data: RecipeCreate) {
    return new ProductRepository().createRecipe(productId, data);
  }

  static async updateRecipe(productId: number, recipeId: number, data: RecipeUpdate) {
    return new ProductRepository().updateRecipe(productId, recipeId, data);
  }
}
