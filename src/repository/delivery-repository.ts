import prisma from "@/lib/db";
import { PackType, Prisma } from "@/app/generated/prisma/client";
import BadRequestException from "@/exceptions/bad-request-exception";
import NotFoundException from "@/exceptions/not-found-exception";
import {
  getCurrentBusinessDate,
  getCurrentBusinessDateTime,
} from "@/lib/business-date";
import { ManagerRepository } from "@/repository/manager-repository";
import { DeliveryCreate } from "@/types/delivery";
import logger from "@/util/logger";

type DeliveryWithRelations = {
  delivery_id: string;
  manager_id: number;
  supplier_id: number;
  date_received: Date;
  notes: string | null;
  sync_status: string;
  synced_at: Date | null;
  supplier: { name: string };
  line_items: Array<{
    item_id: number;
    config_id: number;
    qty_received: Prisma.Decimal;
    cost_per_unit: Prisma.Decimal;
    item: { name: string };
    config: { pack_name: PackType; base_unit_qty: Prisma.Decimal };
  }>;
};

function mapDelivery(delivery: DeliveryWithRelations) {
  return {
    delivery_id: delivery.delivery_id,
    manager_id: delivery.manager_id,
    supplier_id: delivery.supplier_id,
    supplier_name: delivery.supplier.name,
    date_received: delivery.date_received,
    notes: delivery.notes,
    sync_status: delivery.sync_status,
    synced_at: delivery.synced_at,
    line_items: delivery.line_items.map((line) => ({
      item_id: line.item_id,
      item_name: line.item.name,
      config_id: line.config_id,
      pack_name: line.config.pack_name,
      qty_received: Number(line.qty_received),
      base_units_added:
        Number(line.qty_received) * Number(line.config.base_unit_qty),
      cost_per_unit: Number(line.cost_per_unit),
    })),
  };
}

const deliveryInclude = {
  supplier: true,
  line_items: { include: { item: true, config: true } },
} satisfies Prisma.DeliveryInclude;

export class DeliveryRepository {
  async createDelivery(data: DeliveryCreate, managerId: number) {
    try {
      const supplier = await prisma.supplier.findUnique({
        where: { supplier_id: data.supplier_id },
      });
      if (!supplier) {
        throw new BadRequestException("Invalid supplier_id");
      }

      const manager = await new ManagerRepository().findManager(managerId);
      if (!manager) {
        throw new BadRequestException("Invalid manager_id");
      }

      const configs = await prisma.packConfiguration.findMany({
        where: {
          config_id: { in: data.line_items.map((line) => line.config_id) },
        },
      });
      const configById = new Map(
        configs.map((config) => [config.config_id, config]),
      );

      for (const line of data.line_items) {
        const config = configById.get(line.config_id);
        if (!config || config.item_id !== line.item_id) {
          throw new BadRequestException(
            "item_id not in the predefined list, or config_id does not belong to that item",
          );
        }
      }

      const delivery = await prisma.$transaction(async (tx) => {
        const created = await tx.delivery.create({
          data: {
            manager_id: managerId,
            supplier_id: data.supplier_id,
            date_received: getCurrentBusinessDate(),
            notes: data.notes ?? null,
            sync_status: "synced",
            synced_at: getCurrentBusinessDateTime(),
            line_items: {
              create: data.line_items.map((line) => ({
                item_id: line.item_id,
                config_id: line.config_id,
                qty_received: line.qty_received,
                // cost_per_unit is derived: the manager enters what they paid in total
                // for qty_received packs, not a per-pack figure.
                cost_per_unit: line.total_cost / line.qty_received,
              })),
            },
          },
          include: deliveryInclude,
        });

        for (const line of data.line_items) {
          const config = configById.get(line.config_id)!;
          await tx.inventoryItem.update({
            where: { item_id: line.item_id },
            data: {
              current_stock: {
                increment: line.qty_received * Number(config.base_unit_qty),
              },
            },
          });
        }

        return created;
      });

      return mapDelivery(delivery);
    } catch (error) {
      // deliberate validation throws above (invalid supplier_id/manager_id/item_id)
      // are already the right type — pass them through unchanged, don't re-wrap them
      if (error instanceof BadRequestException) {
        throw error;
      }
      // anything else here is unexpected (DB/infra failure, bug) — log it with full
      // context and rethrow as-is so it surfaces as a 500, not a misleading 400
      logger.error("Failed to create delivery for manager_id=%d: %s", managerId, error);
      throw error;
    }
  }

  async listDeliveries(dateReceived?: Date, supplierId?: number) {
    const deliveries = await prisma.delivery.findMany({
      where: {
        ...(dateReceived ? { date_received: dateReceived } : {}),
        ...(supplierId !== undefined ? { supplier_id: supplierId } : {}),
      },
      include: deliveryInclude,
    });
    return deliveries.map(mapDelivery);
  }

  async getDelivery(deliveryId: string) {
    const delivery = await prisma.delivery.findUnique({
      where: { delivery_id: deliveryId },
      include: deliveryInclude,
    });
    if (!delivery) {
      throw new NotFoundException("Delivery not found");
    }
    return mapDelivery(delivery);
  }
}
