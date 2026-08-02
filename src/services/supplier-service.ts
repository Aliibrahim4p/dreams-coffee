import { SupplierRepository } from "@/repository/supplier-repository";
import { SupplierCreate, SupplierUpdate } from "@/types/supplier";
import logger from "@/util/logger";

export class SupplierService {
  static async createSupplier(data: SupplierCreate) {
    const supplier = await new SupplierRepository().createSupplier(data);
    logger.info("Supplier created: %s (id=%d)", supplier.name, supplier.supplier_id);
    return supplier;
  }

  static async listSuppliers(includeInactive?: boolean) {
    return new SupplierRepository().listSuppliers(includeInactive);
  }

  static async updateSupplier(supplierId: number, data: SupplierUpdate) {
    const supplier = await new SupplierRepository().updateSupplier(supplierId, data);
    logger.info("Supplier updated: id=%d", supplierId);
    return supplier;
  }

  static async deactivateSupplier(supplierId: number): Promise<void> {
    await new SupplierRepository().deactivateSupplier(supplierId);
    logger.info("Supplier deactivated: id=%d", supplierId);
  }
}
