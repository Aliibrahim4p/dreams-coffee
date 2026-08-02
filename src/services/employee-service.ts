import { EmployeeRepository } from "@/repository/employee-repository";
import { EmployeeCreate, EmployeeUpdate } from "@/types/employee";

export class EmployeeService {
  static async createEmployee(data: EmployeeCreate) {
    return new EmployeeRepository().createEmployee(data);
  }

  static async listEmployees(includeInactive: boolean) {
    return new EmployeeRepository().listEmployees(includeInactive);
  }

  static async getEmployee(posId: number) {
    return new EmployeeRepository().getEmployee(posId);
  }

  static async updateEmployee(posId: number, data: EmployeeUpdate) {
    return new EmployeeRepository().updateEmployee(posId, data);
  }

  static async deactivateEmployee(posId: number): Promise<void> {
    return new EmployeeRepository().deactivateEmployee(posId);
  }
}
