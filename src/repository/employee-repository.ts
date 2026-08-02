import prisma from "@/lib/db";
import UniqueException from "@/exceptions/unique-exception";
import NotFoundException from "@/exceptions/not-found-exception";
import { isNotFoundError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { EmployeeCreate, EmployeeUpdate } from "@/types/employee";

function mapEmployee(employee: { pos_id: number; first_name: string; last_name: string; is_active: boolean }) {
  return {
    pos_id: employee.pos_id,
    first_name: employee.first_name,
    last_name: employee.last_name,
    is_active: employee.is_active,
  };
}

export class EmployeeRepository {
  async createEmployee(data: EmployeeCreate) {
    try {
      const employee = await prisma.employee.create({ data });
      return mapEmployee(employee);
    } catch (error) {
      if (isUniqueConstraintError(error, "pos_id")) {
        throw new UniqueException("pos_id already taken");
      }
      throw error;
    }
  }

  async listEmployees(includeInactive: boolean) {
    const employees = await prisma.employee.findMany({
      where: includeInactive ? undefined : { is_active: true },
    });
    return employees.map(mapEmployee);
  }

  async getEmployee(posId: number) {
    const employee = await prisma.employee.findUnique({ where: { pos_id: posId } });
    if (!employee) {
      throw new NotFoundException("Employee not found");
    }
    return mapEmployee(employee);
  }

  async updateEmployee(posId: number, data: EmployeeUpdate) {
    try {
      const employee = await prisma.employee.update({ where: { pos_id: posId }, data });
      return mapEmployee(employee);
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new NotFoundException("Employee not found");
      }
      throw error;
    }
  }

  async deactivateEmployee(posId: number): Promise<void> {
    try {
      await prisma.employee.update({ where: { pos_id: posId }, data: { is_active: false } });
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new NotFoundException("Employee not found");
      }
      throw error;
    }
  }
}
