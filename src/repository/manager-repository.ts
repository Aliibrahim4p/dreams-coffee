import prisma from "@/lib/db";
import { hashPassword } from "@/lib/password";
import UniqueException from "@/exceptions/unique-exception";
import NotFoundException from "@/exceptions/not-found-exception";
import { isNotFoundError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { ManagerCreate, ManagerUpdate } from "@/types/manager";

function mapManager(manager: {
  manager_id: number;
  username: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  created_at: Date;
}) {
  return {
    manager_id: manager.manager_id,
    username: manager.username,
    first_name: manager.first_name,
    last_name: manager.last_name,
    is_active: manager.is_active,
    created_at: manager.created_at,
  };
}

export class ManagerRepository {
  async createManager(data: ManagerCreate) {
    try {
      const password_hash = await hashPassword(data.password);
      const manager = await prisma.manager.create({
        data: {
          username: data.username,
          password_hash,
          first_name: data.first_name,
          last_name: data.last_name,
          created_at: new Date(),
        },
      });
      return mapManager(manager);
    } catch (error) {
      if (isUniqueConstraintError(error, "username")) {
        throw new UniqueException("Username already taken");
      }
      throw error;
    }
  }

  async listManagers(includeInactive: boolean) {
    const managers = await prisma.manager.findMany({
      where: includeInactive ? undefined : { is_active: true },
    });
    return managers.map(mapManager);
  }

  async getManager(managerId: number) {
    const manager = await prisma.manager.findUnique({ where: { manager_id: managerId } });
    if (!manager) {
      throw new NotFoundException("Manager not found");
    }
    return mapManager(manager);
  }

  /** Includes password_hash — for login verification only, never return this to a client. */
  async findByUsername(username: string) {
    return prisma.manager.findUnique({ where: { username } });
  }

  /** Raw existence lookup, `null` if not found — for callers validating a manager_id input, not returning the manager itself. */
  async findManager(managerId: number) {
    return prisma.manager.findUnique({ where: { manager_id: managerId } });
  }

  async isActiveManager(managerId: number): Promise<boolean> {
    const manager = await prisma.manager.findUnique({
      where: { manager_id: managerId },
      select: { is_active: true },
    });
    return manager?.is_active ?? false;
  }

  async updateManager(managerId: number, data: ManagerUpdate) {
    const { password, ...rest } = data;
    try {
      const manager = await prisma.manager.update({
        where: { manager_id: managerId },
        data: {
          ...rest,
          ...(password !== undefined ? { password_hash: await hashPassword(password) } : {}),
        },
      });
      return mapManager(manager);
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new NotFoundException("Manager not found");
      }
      if (isUniqueConstraintError(error, "username")) {
        throw new UniqueException("Username already taken");
      }
      throw error;
    }
  }

  async deactivateManager(managerId: number): Promise<void> {
    try {
      await prisma.manager.update({
        where: { manager_id: managerId },
        data: { is_active: false },
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new NotFoundException("Manager not found");
      }
      throw error;
    }
  }
}
