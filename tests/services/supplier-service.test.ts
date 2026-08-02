jest.mock("@/repository/supplier-repository");

import { SupplierRepository } from "@/repository/supplier-repository";
import { SupplierService } from "@/services/supplier-service";

const MockedSupplierRepository = SupplierRepository as jest.MockedClass<typeof SupplierRepository>;

function mockRepo(overrides: Partial<Record<string, jest.Mock>>) {
  MockedSupplierRepository.mockImplementation(() => overrides as unknown as SupplierRepository);
}

describe("SupplierService", () => {
  it("createSupplier delegates to the repository", async () => {
    const createSupplier = jest.fn().mockResolvedValue({ supplier_id: 1 });
    mockRepo({ createSupplier });

    await SupplierService.createSupplier({ name: "Acme" });

    expect(createSupplier).toHaveBeenCalledWith({ name: "Acme" });
  });

  it("listSuppliers delegates to the repository", async () => {
    const listSuppliers = jest.fn().mockResolvedValue([]);
    mockRepo({ listSuppliers });

    await SupplierService.listSuppliers();

    expect(listSuppliers).toHaveBeenCalled();
  });

  it("updateSupplier delegates to the repository", async () => {
    const updateSupplier = jest.fn().mockResolvedValue({ supplier_id: 1 });
    mockRepo({ updateSupplier });

    await SupplierService.updateSupplier(1, { name: "New" });

    expect(updateSupplier).toHaveBeenCalledWith(1, { name: "New" });
  });

  it("deactivateSupplier delegates to the repository", async () => {
    const deactivateSupplier = jest.fn().mockResolvedValue(undefined);
    mockRepo({ deactivateSupplier });

    await SupplierService.deactivateSupplier(1);

    expect(deactivateSupplier).toHaveBeenCalledWith(1);
  });
});
