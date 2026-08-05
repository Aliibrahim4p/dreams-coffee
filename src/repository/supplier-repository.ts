import prisma from "@/lib/db";
import NotFoundException from "@/exceptions/not-found-exception";
import { isNotFoundError } from "@/lib/prisma-errors";
import { SupplierCreate, SupplierUpdate } from "@/types/supplier";
import logger from "@/util/logger";

function mapSupplier(supplier: { supplier_id: number; name: string; is_active: boolean }) {
  return {
    supplier_id: supplier.supplier_id,
    name: supplier.name,
    is_active: supplier.is_active,
  };
}

export class SupplierRepository {
  async createSupplier(data: SupplierCreate) {
    try {
      const supplier = await prisma.supplier.create({ data: { name: data.name } });
      return mapSupplier(supplier);
    } catch (error) {
      logger.error("Failed to create supplier name=%s: %s", data.name, error);
      throw error;
    }
  }

  async listSuppliers(includeInactive?: boolean) {
    const suppliers = await prisma.supplier.findMany({
      where: includeInactive ? undefined : { is_active: true },
    });
    return suppliers.map(mapSupplier);
  }

  async updateSupplier(supplierId: number, data: SupplierUpdate) {
    try {
      const supplier = await prisma.supplier.update({
        where: { supplier_id: supplierId },
        data,
      });
      return mapSupplier(supplier);
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new NotFoundException("Supplier not found");
      }
      logger.error("Failed to update supplier_id=%d: %s", supplierId, error);
      throw error;
    }
  }

  async deactivateSupplier(supplierId: number): Promise<void> {
    try {
      await prisma.supplier.update({
        where: { supplier_id: supplierId },
        data: { is_active: false },
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new NotFoundException("Supplier not found");
      }
      logger.error("Failed to deactivate supplier_id=%d: %s", supplierId, error);
      throw error;
    }
  }
}
