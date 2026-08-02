import { ProductRepository } from "@/repository/product-repository";
import { ProductCreate, ProductUpdate } from "@/types/product";
import { RecipeCreate, RecipeUpdate } from "@/types/recipe";
import logger from "@/util/logger";

export class ProductService {
  static async createProduct(data: ProductCreate) {
    const product = await new ProductRepository().createProduct(data);
    logger.info("Product created: %s (id=%d)", product.name, product.product_id);
    return product;
  }

  static async updateProduct(productId: number, data: ProductUpdate) {
    const product = await new ProductRepository().updateProduct(productId, data);
    logger.info("Product updated: id=%d", productId);
    return product;
  }

  static async deactivateProduct(productId: number): Promise<void> {
    await new ProductRepository().deactivateProduct(productId);
    logger.info("Product deactivated: id=%d", productId);
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
    const recipe = await new ProductRepository().createRecipe(productId, data);
    logger.info("Recipe created: product_id=%d modifier_id=%s", productId, data.modifier_id);
    return recipe;
  }

  static async updateRecipe(productId: number, recipeId: number, data: RecipeUpdate) {
    const recipe = await new ProductRepository().updateRecipe(productId, recipeId, data);
    logger.info("Recipe updated: product_id=%d recipe_id=%d", productId, recipeId);
    return recipe;
  }
}
