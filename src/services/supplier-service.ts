import { SupplierRepository } from "@/repository/supplier-repository";
import { SupplierCreate, SupplierUpdate } from "@/types/supplier";

export class SupplierService {
  static async createSupplier(data: SupplierCreate) {
    return new SupplierRepository().createSupplier(data);
  }

  static async listSuppliers(includeInactive?: boolean) {
    return new SupplierRepository().listSuppliers(includeInactive);
  }

  static async updateSupplier(supplierId: number, data: SupplierUpdate) {
    return new SupplierRepository().updateSupplier(supplierId, data);
  }

  static async deactivateSupplier(supplierId: number): Promise<void> {
    return new SupplierRepository().deactivateSupplier(supplierId);
  }
}
