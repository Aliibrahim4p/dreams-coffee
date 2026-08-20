jest.mock("@/repository/employee-repository");

import { EmployeeRepository } from "@/repository/employee-repository";
import { EmployeeService } from "@/services/employee-service";

const MockedEmployeeRepository = EmployeeRepository as jest.MockedClass<typeof EmployeeRepository>;

function mockRepo(overrides: Partial<Record<string, jest.Mock>>) {
  MockedEmployeeRepository.mockImplementation(() => overrides as unknown as EmployeeRepository);
}

describe("EmployeeService", () => {
  it("createEmployee delegates to the repository", async () => {
    const createEmployee = jest.fn().mockResolvedValue({ pos_id: 101 });
    mockRepo({ createEmployee });
    const data = { pos_id: 101, first_name: "Jane", last_name: "Doe" };

    const result = await EmployeeService.createEmployee(data);

    expect(createEmployee).toHaveBeenCalledWith(data);
    expect(result).toEqual({ pos_id: 101 });
  });

  it("listEmployees delegates to the repository", async () => {
    const listEmployees = jest.fn().mockResolvedValue([]);
    mockRepo({ listEmployees });

    await EmployeeService.listEmployees(true);

    expect(listEmployees).toHaveBeenCalledWith(true);
  });

  it("getEmployee delegates to the repository", async () => {
    const getEmployee = jest.fn().mockResolvedValue({ pos_id: 101 });
    mockRepo({ getEmployee });

    await EmployeeService.getEmployee(101);

    expect(getEmployee).toHaveBeenCalledWith(101);
  });

  it("updateEmployee delegates to the repository", async () => {
    const updateEmployee = jest.fn().mockResolvedValue({ pos_id: 101, first_name: "New" });
    mockRepo({ updateEmployee });

    await EmployeeService.updateEmployee(101, { first_name: "New" });

    expect(updateEmployee).toHaveBeenCalledWith(101, { first_name: "New" });
  });

  it("deactivateEmployee delegates to the repository", async () => {
    const deactivateEmployee = jest.fn().mockResolvedValue(undefined);
    mockRepo({ deactivateEmployee });

    await EmployeeService.deactivateEmployee(101);

    expect(deactivateEmployee).toHaveBeenCalledWith(101);
  });
});
