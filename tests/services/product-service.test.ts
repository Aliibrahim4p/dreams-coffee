jest.mock("@/repository/product-repository");

import { ProductRepository } from "@/repository/product-repository";
import { ProductService } from "@/services/product-service";

const MockedProductRepository = ProductRepository as jest.MockedClass<typeof ProductRepository>;

function mockRepo(overrides: Partial<Record<string, jest.Mock>>) {
  MockedProductRepository.mockImplementation(() => overrides as unknown as ProductRepository);
}

describe("ProductService", () => {
  it("createProduct delegates to the repository", async () => {
    const createProduct = jest.fn().mockResolvedValue({ product_id: 1 });
    mockRepo({ createProduct });

    const data = { category_id: 1, name: "Latte", type: "reseller" as const, base_price: 1000 };
    const result = await ProductService.createProduct(data);

    expect(createProduct).toHaveBeenCalledWith(data);
    expect(result).toEqual({ product_id: 1 });
  });

  it("updateProduct delegates to the repository", async () => {
    const updateProduct = jest.fn().mockResolvedValue({ product_id: 1, name: "New" });
    mockRepo({ updateProduct });

    const result = await ProductService.updateProduct(1, { name: "New" });

    expect(updateProduct).toHaveBeenCalledWith(1, { name: "New" });
    expect(result).toEqual({ product_id: 1, name: "New" });
  });

  it("deactivateProduct delegates to the repository", async () => {
    const deactivateProduct = jest.fn().mockResolvedValue(undefined);
    mockRepo({ deactivateProduct });

    await ProductService.deactivateProduct(1);

    expect(deactivateProduct).toHaveBeenCalledWith(1);
  });

  it("listCategoryProducts delegates to the repository", async () => {
    const listCategoryProducts = jest.fn().mockResolvedValue([]);
    mockRepo({ listCategoryProducts });

    await ProductService.listCategoryProducts(3, true);

    expect(listCategoryProducts).toHaveBeenCalledWith(3, true);
  });

  it("getProductSizes delegates to the repository", async () => {
    const getProductSizes = jest.fn().mockResolvedValue([]);
    mockRepo({ getProductSizes });

    await ProductService.getProductSizes(2);

    expect(getProductSizes).toHaveBeenCalledWith(2);
  });

  it("getProductRecipe delegates to the repository with an optional modifier_id", async () => {
    const getProductRecipe = jest.fn().mockResolvedValue([]);
    mockRepo({ getProductRecipe });

    await ProductService.getProductRecipe(2, 5);

    expect(getProductRecipe).toHaveBeenCalledWith(2, 5);
  });

  it("createRecipe delegates to the repository", async () => {
    const createRecipe = jest.fn().mockResolvedValue({ recipe_id: 1 });
    mockRepo({ createRecipe });
    const data = { modifier_id: 1, ingredients: [{ item_id: 5, quantity: 200, unit: "ml" as const }] };

    await ProductService.createRecipe(2, data);

    expect(createRecipe).toHaveBeenCalledWith(2, data);
  });

  it("updateRecipe delegates to the repository", async () => {
    const updateRecipe = jest.fn().mockResolvedValue({ recipe_id: 10 });
    mockRepo({ updateRecipe });
    const data = { ingredients: [{ item_id: 5, quantity: 250, unit: "ml" as const }] };

    await ProductService.updateRecipe(2, 10, data);

    expect(updateRecipe).toHaveBeenCalledWith(2, 10, data);
  });
});
