jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    employee: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import prisma from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import UniqueException from "@/exceptions/unique-exception";
import NotFoundException from "@/exceptions/not-found-exception";
import { EmployeeRepository } from "@/repository/employee-repository";

const db = prisma as unknown as {
  employee: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

function notFoundError() {
  return new Prisma.PrismaClientKnownRequestError("not found", { code: "P2025", clientVersion: "test" });
}

function uniqueError(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError("unique violation", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

const row = { pos_id: 101, first_name: "Jane", last_name: "Doe", is_active: true };

describe("EmployeeRepository.createEmployee", () => {
  const repo = new EmployeeRepository();

  it("creates and returns the employee", async () => {
    db.employee.create.mockResolvedValue(row);
    const result = await repo.createEmployee({ pos_id: 101, first_name: "Jane", last_name: "Doe" });
    expect(result).toEqual(row);
  });

  it("throws UniqueException when pos_id is already taken", async () => {
    db.employee.create.mockRejectedValue(uniqueError(["pos_id"]));
    await expect(
      repo.createEmployee({ pos_id: 101, first_name: "Jane", last_name: "Doe" }),
    ).rejects.toThrow(UniqueException);
  });
});

describe("EmployeeRepository.listEmployees", () => {
  const repo = new EmployeeRepository();

  it("filters to active employees by default", async () => {
    db.employee.findMany.mockResolvedValue([row]);
    await repo.listEmployees(false);
    expect(db.employee.findMany).toHaveBeenCalledWith({ where: { is_active: true } });
  });

  it("includes inactive employees when requested", async () => {
    db.employee.findMany.mockResolvedValue([row]);
    await repo.listEmployees(true);
    expect(db.employee.findMany).toHaveBeenCalledWith({ where: undefined });
  });
});

describe("EmployeeRepository.getEmployee", () => {
  const repo = new EmployeeRepository();

  it("throws NotFoundException when the employee does not exist", async () => {
    db.employee.findUnique.mockResolvedValue(null);
    await expect(repo.getEmployee(999)).rejects.toThrow(NotFoundException);
  });

  it("returns the mapped employee", async () => {
    db.employee.findUnique.mockResolvedValue(row);
    await expect(repo.getEmployee(101)).resolves.toEqual(row);
  });
});

describe("EmployeeRepository.updateEmployee", () => {
  const repo = new EmployeeRepository();

  it("throws NotFoundException when the employee does not exist", async () => {
    db.employee.update.mockRejectedValue(notFoundError());
    await expect(repo.updateEmployee(999, { first_name: "New" })).rejects.toThrow(NotFoundException);
  });
});

describe("EmployeeRepository.deactivateEmployee", () => {
  const repo = new EmployeeRepository();

  it("throws NotFoundException when the employee does not exist", async () => {
    db.employee.update.mockRejectedValue(notFoundError());
    await expect(repo.deactivateEmployee(999)).rejects.toThrow(NotFoundException);
  });
});
