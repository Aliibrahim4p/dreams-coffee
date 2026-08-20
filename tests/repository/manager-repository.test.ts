jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    manager: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock("@/lib/password", () => ({
  hashPassword: jest.fn(async (password: string) => `hashed:${password}`),
}));

import prisma from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import { hashPassword } from "@/lib/password";
import UniqueException from "@/exceptions/unique-exception";
import NotFoundException from "@/exceptions/not-found-exception";
import { ManagerRepository } from "@/repository/manager-repository";

const db = prisma as unknown as {
  manager: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
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

const row = {
  manager_id: 1,
  username: "jdoe",
  password_hash: "hashed:hunter2",
  first_name: "Jane",
  last_name: "Doe",
  is_active: true,
  created_at: new Date("2026-01-01"),
};

describe("ManagerRepository.createManager", () => {
  const repo = new ManagerRepository();

  it("hashes the password and excludes password_hash from the result", async () => {
    db.manager.create.mockResolvedValue(row);

    const result = await repo.createManager({
      username: "jdoe",
      password: "hunter2",
      first_name: "Jane",
      last_name: "Doe",
    });

    expect(hashPassword).toHaveBeenCalledWith("hunter2");
    expect(db.manager.create).toHaveBeenCalledWith({
      data: {
        username: "jdoe",
        password_hash: "hashed:hunter2",
        first_name: "Jane",
        last_name: "Doe",
        created_at: expect.any(Date),
      },
    });
    expect(result).not.toHaveProperty("password_hash");
    expect(result.username).toBe("jdoe");
  });

  it("throws UniqueException when username is already taken", async () => {
    db.manager.create.mockRejectedValue(uniqueError(["username"]));

    await expect(
      repo.createManager({ username: "jdoe", password: "x", first_name: "A", last_name: "B" }),
    ).rejects.toThrow(UniqueException);
  });
});

describe("ManagerRepository.listManagers", () => {
  const repo = new ManagerRepository();

  it("filters to active managers by default", async () => {
    db.manager.findMany.mockResolvedValue([row]);
    await repo.listManagers(false);
    expect(db.manager.findMany).toHaveBeenCalledWith({ where: { is_active: true } });
  });
});

describe("ManagerRepository.getManager", () => {
  const repo = new ManagerRepository();

  it("throws NotFoundException when the manager does not exist", async () => {
    db.manager.findUnique.mockResolvedValue(null);
    await expect(repo.getManager(999)).rejects.toThrow(NotFoundException);
  });
});

describe("ManagerRepository.updateManager", () => {
  const repo = new ManagerRepository();

  it("hashes a new password when provided", async () => {
    db.manager.update.mockResolvedValue(row);

    await repo.updateManager(1, { password: "newpass" });

    expect(hashPassword).toHaveBeenCalledWith("newpass");
    expect(db.manager.update).toHaveBeenCalledWith({
      where: { manager_id: 1 },
      data: { password_hash: "hashed:newpass" },
    });
  });

  it("does not touch password_hash when password is not provided", async () => {
    db.manager.update.mockResolvedValue(row);

    await repo.updateManager(1, { first_name: "Janet" });

    expect(db.manager.update).toHaveBeenCalledWith({
      where: { manager_id: 1 },
      data: { first_name: "Janet" },
    });
  });

  it("throws NotFoundException when the manager does not exist", async () => {
    db.manager.update.mockRejectedValue(notFoundError());
    await expect(repo.updateManager(999, { first_name: "New" })).rejects.toThrow(NotFoundException);
  });

  it("throws UniqueException when the new username is taken", async () => {
    db.manager.update.mockRejectedValue(uniqueError(["username"]));
    await expect(repo.updateManager(1, { username: "taken" })).rejects.toThrow(UniqueException);
  });
});

describe("ManagerRepository.deactivateManager", () => {
  const repo = new ManagerRepository();

  it("throws NotFoundException when the manager does not exist", async () => {
    db.manager.update.mockRejectedValue(notFoundError());
    await expect(repo.deactivateManager(999)).rejects.toThrow(NotFoundException);
  });
});

describe("ManagerRepository.findByUsername", () => {
  const repo = new ManagerRepository();

  it("returns the raw row including password_hash", async () => {
    db.manager.findUnique.mockResolvedValue(row);
    const result = await repo.findByUsername("jdoe");
    expect(result).toEqual(row);
    expect(db.manager.findUnique).toHaveBeenCalledWith({ where: { username: "jdoe" } });
  });

  it("returns null when no manager matches", async () => {
    db.manager.findUnique.mockResolvedValue(null);
    await expect(repo.findByUsername("nobody")).resolves.toBeNull();
  });
});

describe("ManagerRepository.findManager", () => {
  const repo = new ManagerRepository();

  it("returns the raw row when found", async () => {
    db.manager.findUnique.mockResolvedValue(row);
    await expect(repo.findManager(1)).resolves.toEqual(row);
    expect(db.manager.findUnique).toHaveBeenCalledWith({ where: { manager_id: 1 } });
  });

  it("returns null instead of throwing when not found", async () => {
    db.manager.findUnique.mockResolvedValue(null);
    await expect(repo.findManager(999)).resolves.toBeNull();
  });
});

describe("ManagerRepository.isActiveManager", () => {
  const repo = new ManagerRepository();

  it("returns true for an active manager", async () => {
    db.manager.findUnique.mockResolvedValue({ is_active: true });
    await expect(repo.isActiveManager(1)).resolves.toBe(true);
  });

  it("returns false for an inactive manager", async () => {
    db.manager.findUnique.mockResolvedValue({ is_active: false });
    await expect(repo.isActiveManager(1)).resolves.toBe(false);
  });

  it("returns false when the manager does not exist", async () => {
    db.manager.findUnique.mockResolvedValue(null);
    await expect(repo.isActiveManager(999)).resolves.toBe(false);
  });
});
