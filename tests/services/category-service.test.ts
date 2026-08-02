jest.mock("@/repository/category-repository");

import { CategoryRepository } from "@/repository/category-repository";
import { CategoryService } from "@/services/category-service";

const MockedCategoryRepository = CategoryRepository as jest.MockedClass<
  typeof CategoryRepository
>;

describe("CategoryService.createCategory", () => {
  it("delegates to CategoryRepository.createCategory", async () => {
    const createCategory = jest
      .fn()
      .mockResolvedValue({ id: 1, name: "Coffee" });
    MockedCategoryRepository.mockImplementation(
      () => ({ createCategory }) as unknown as CategoryRepository,
    );

    const result = await CategoryService.createCategory({ name: "Coffee" });

    expect(createCategory).toHaveBeenCalledWith({ name: "Coffee" });
    expect(result).toEqual({ id: 1, name: "Coffee" });
  });

  it("propagates errors thrown by the repository", async () => {
    const error = new Error("boom");
    const createCategory = jest.fn().mockRejectedValue(error);
    MockedCategoryRepository.mockImplementation(
      () => ({ createCategory }) as unknown as CategoryRepository,
    );

    await expect(
      CategoryService.createCategory({ name: "Coffee" }),
    ).rejects.toThrow("boom");
  });
});

describe("CategoryService.listCategories", () => {
  it("delegates to CategoryRepository.listCategories", async () => {
    const listCategories = jest.fn().mockResolvedValue([]);
    MockedCategoryRepository.mockImplementation(
      () => ({ listCategories }) as unknown as CategoryRepository,
    );

    await CategoryService.listCategories(true);

    expect(listCategories).toHaveBeenCalledWith(true, undefined);
  });
});

describe("CategoryService.updateCategory", () => {
  it("delegates to CategoryRepository.updateCategory", async () => {
    const updateCategory = jest
      .fn()
      .mockResolvedValue({ category_id: 1, name: "New" });
    MockedCategoryRepository.mockImplementation(
      () => ({ updateCategory }) as unknown as CategoryRepository,
    );

    const result = await CategoryService.updateCategory(1, { name: "New" });

    expect(updateCategory).toHaveBeenCalledWith(1, { name: "New" });
    expect(result).toEqual({ category_id: 1, name: "New" });
  });
});

describe("CategoryService.deactivateCategory", () => {
  it("delegates to CategoryRepository.deactivateCategory", async () => {
    const deactivateCategory = jest.fn().mockResolvedValue(undefined);
    MockedCategoryRepository.mockImplementation(
      () => ({ deactivateCategory }) as unknown as CategoryRepository,
    );

    await CategoryService.deactivateCategory(1);

    expect(deactivateCategory).toHaveBeenCalledWith(1);
  });
});
