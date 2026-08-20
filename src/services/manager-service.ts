import { ManagerRepository } from "@/repository/manager-repository";
import { ManagerCreate, ManagerUpdate } from "@/types/manager";
import logger from "@/util/logger";

export class ManagerService {
  static async createManager(data: ManagerCreate) {
    const manager = await new ManagerRepository().createManager(data);
    logger.info("Manager created: manager_id=%d username=%s", manager.manager_id, manager.username);
    return manager;
  }

  static async listManagers(includeInactive: boolean) {
    return new ManagerRepository().listManagers(includeInactive);
  }

  static async getManager(managerId: number) {
    return new ManagerRepository().getManager(managerId);
  }

  static async updateManager(managerId: number, data: ManagerUpdate) {
    const manager = await new ManagerRepository().updateManager(managerId, data);
    logger.info("Manager updated: manager_id=%d", managerId);
    return manager;
  }

  static async deactivateManager(managerId: number): Promise<void> {
    await new ManagerRepository().deactivateManager(managerId);
    logger.info("Manager deactivated: manager_id=%d", managerId);
  }
}
