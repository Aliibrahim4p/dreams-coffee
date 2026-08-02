import { ManagerRepository } from "@/repository/manager-repository";
import { ManagerCreate, ManagerUpdate } from "@/types/manager";

export class ManagerService {
  static async createManager(data: ManagerCreate) {
    return new ManagerRepository().createManager(data);
  }

  static async listManagers(includeInactive: boolean) {
    return new ManagerRepository().listManagers(includeInactive);
  }

  static async getManager(managerId: number) {
    return new ManagerRepository().getManager(managerId);
  }

  static async updateManager(managerId: number, data: ManagerUpdate) {
    return new ManagerRepository().updateManager(managerId, data);
  }

  static async deactivateManager(managerId: number): Promise<void> {
    return new ManagerRepository().deactivateManager(managerId);
  }
}
