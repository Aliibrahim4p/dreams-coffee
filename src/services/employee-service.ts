import { EmployeeRepository } from "@/repository/employee-repository";
import { EmployeeCreate, EmployeeUpdate } from "@/types/employee";
import logger from "@/util/logger";

export class EmployeeService {
  static async createEmployee(data: EmployeeCreate) {
    const employee = await new EmployeeRepository().createEmployee(data);
    logger.info("Employee created: pos_id=%d", employee.pos_id);
    return employee;
  }

  static async listEmployees(includeInactive: boolean) {
    return new EmployeeRepository().listEmployees(includeInactive);
  }

  static async getEmployee(posId: number) {
    return new EmployeeRepository().getEmployee(posId);
  }

  static async updateEmployee(posId: number, data: EmployeeUpdate) {
    const employee = await new EmployeeRepository().updateEmployee(posId, data);
    logger.info("Employee updated: pos_id=%d", posId);
    return employee;
  }

  static async deactivateEmployee(posId: number): Promise<void> {
    await new EmployeeRepository().deactivateEmployee(posId);
    logger.info("Employee deactivated: pos_id=%d", posId);
  }
}
