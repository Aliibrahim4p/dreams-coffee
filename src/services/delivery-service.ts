import { DeliveryRepository } from "@/repository/delivery-repository";
import { DeliveryCreate } from "@/types/delivery";

export class DeliveryService {
  static async createDelivery(data: DeliveryCreate, managerId: number) {
    return new DeliveryRepository().createDelivery(data, managerId);
  }

  static async listDeliveries(dateReceived?: Date, supplierId?: number) {
    return new DeliveryRepository().listDeliveries(dateReceived, supplierId);
  }

  static async getDelivery(deliveryId: string) {
    return new DeliveryRepository().getDelivery(deliveryId);
  }
}
