import { DeliveryRepository } from "@/repository/delivery-repository";
import { DeliveryCreate } from "@/types/delivery";
import logger from "@/util/logger";

export class DeliveryService {
  static async createDelivery(data: DeliveryCreate, managerId: number) {
    const delivery = await new DeliveryRepository().createDelivery(data, managerId);
    logger.info("Delivery recorded: id=%s by manager=%d", delivery.delivery_id, managerId);
    return delivery;
  }

  static async listDeliveries(dateReceived?: Date, supplierId?: number) {
    return new DeliveryRepository().listDeliveries(dateReceived, supplierId);
  }

  static async getDelivery(deliveryId: string) {
    return new DeliveryRepository().getDelivery(deliveryId);
  }
}
