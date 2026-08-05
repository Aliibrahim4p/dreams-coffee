jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    employee: { findUnique: jest.fn() },
    shiftSession: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    order: { findFirst: jest.fn(), aggregate: jest.fn() },
  },
}));

import prisma from "@/lib/db";
import NotFoundException from "@/exceptions/not-found-exception";
import UniqueException from "@/exceptions/unique-exception";
import { ShiftSessionRepository } from "@/repository/shift-session-repository";

const db = prisma as unknown as {
  employee: { findUnique: jest.Mock };
  shiftSession: { count: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  order: { findFirst: jest.Mock; aggregate: jest.Mock };
};

const employeeRow = { pos_id: 1, first_name: "John", last_name: "Doe", is_active: true };

const sessionRow = {
  session_id: "session-1",
  cashier_pos_id: 1,
  starting_float: 50000,
  start_time: new Date("2026-08-01T08:00:00Z"),
  end_time: null,
  live_cash_total: 50000,
  cashier: { first_name: "John", last_name: "Doe" },
};

describe("ShiftSessionRepository.openSession", () => {
  const repo = new ShiftSessionRepository();

  it("throws NotFoundException when cashier_pos_id does not match an employee", async () => {
    db.employee.findUnique.mockResolvedValue(null);

    await expect(repo.openSession({ cashier_pos_id: 999, starting_float: 50000 })).rejects.toThrow(
      NotFoundException,
    );
    expect(db.shiftSession.count).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when the employee is deactivated", async () => {
    db.employee.findUnique.mockResolvedValue({ ...employeeRow, is_active: false });

    await expect(repo.openSession({ cashier_pos_id: 1, starting_float: 50000 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it("allows opening a second session when only one terminal is currently open (NFR-011)", async () => {
    db.employee.findUnique.mockResolvedValue(employeeRow);
    db.shiftSession.count.mockResolvedValue(1);
    db.shiftSession.create.mockResolvedValue(sessionRow);

    await expect(repo.openSession({ cashier_pos_id: 1, starting_float: 50000 })).resolves.toBeDefined();
    expect(db.shiftSession.create).toHaveBeenCalled();
  });

  it("throws UniqueException when the max concurrent terminal sessions are already open", async () => {
    db.employee.findUnique.mockResolvedValue(employeeRow);
    db.shiftSession.count.mockResolvedValue(2);

    await expect(repo.openSession({ cashier_pos_id: 1, starting_float: 50000 })).rejects.toThrow(
      UniqueException,
    );
    expect(db.shiftSession.create).not.toHaveBeenCalled();
  });

  it("creates the session with live_cash_total seeded from starting_float", async () => {
    db.employee.findUnique.mockResolvedValue(employeeRow);
    db.shiftSession.count.mockResolvedValue(0);
    db.shiftSession.create.mockResolvedValue(sessionRow);

    const result = await repo.openSession({ cashier_pos_id: 1, starting_float: 50000 });

    expect(db.shiftSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cashier_pos_id: 1,
        starting_float: 50000,
        live_cash_total: 50000,
      }),
      include: { cashier: true },
    });
    expect(result).toEqual({
      session_id: "session-1",
      cashier_pos_id: 1,
      cashier_name: "John Doe",
      starting_float: 50000,
      start_time: sessionRow.start_time,
      end_time: null,
      live_cash_total: 50000,
    });
  });
});

describe("ShiftSessionRepository.cashOut", () => {
  const repo = new ShiftSessionRepository();

  it("throws NotFoundException when the session does not exist", async () => {
    db.shiftSession.findUnique.mockResolvedValue(null);
    await expect(repo.cashOut("missing")).rejects.toThrow(NotFoundException);
  });

  it("throws UniqueException when the session is already closed", async () => {
    db.shiftSession.findUnique.mockResolvedValue({ ...sessionRow, end_time: new Date() });
    await expect(repo.cashOut("session-1")).rejects.toThrow(UniqueException);
  });

  it("throws UniqueException when an order is still open", async () => {
    db.shiftSession.findUnique.mockResolvedValue(sessionRow);
    db.order.findFirst.mockResolvedValue({ order_id: "order-1" });

    await expect(repo.cashOut("session-1")).rejects.toThrow(UniqueException);
    expect(db.shiftSession.update).not.toHaveBeenCalled();
  });

  it("closes the session and returns gross_sales summed from completed orders", async () => {
    db.shiftSession.findUnique.mockResolvedValue(sessionRow);
    db.order.findFirst.mockResolvedValue(null);
    db.order.aggregate.mockResolvedValue({ _sum: { total_due: 42000 } });
    db.shiftSession.update.mockResolvedValue({ ...sessionRow, end_time: new Date("2026-08-01T16:00:00Z") });

    const result = await repo.cashOut("session-1");

    expect(db.order.aggregate).toHaveBeenCalledWith({
      where: { session_id: "session-1", status: "completed" },
      _sum: { total_due: true },
    });
    expect(db.shiftSession.update).toHaveBeenCalledWith({
      where: { session_id: "session-1" },
      data: { end_time: expect.any(Date) },
      include: { cashier: true },
    });
    expect(result.gross_sales).toBe(42000);
    expect(result.end_time).toEqual(new Date("2026-08-01T16:00:00Z"));
  });

  it("gross_sales defaults to 0 when there are no completed orders", async () => {
    db.shiftSession.findUnique.mockResolvedValue(sessionRow);
    db.order.findFirst.mockResolvedValue(null);
    db.order.aggregate.mockResolvedValue({ _sum: { total_due: null } });
    db.shiftSession.update.mockResolvedValue(sessionRow);

    const result = await repo.cashOut("session-1");

    expect(result.gross_sales).toBe(0);
  });
});

describe("ShiftSessionRepository.cashOutCurrent", () => {
  const repo = new ShiftSessionRepository();

  it("throws NotFoundException when no session is open", async () => {
    db.shiftSession.findMany.mockResolvedValue([]);

    await expect(repo.cashOutCurrent()).rejects.toThrow(NotFoundException);
    expect(db.shiftSession.update).not.toHaveBeenCalled();
  });

  it("finds the open session and closes it, same as cashOut(session_id)", async () => {
    db.shiftSession.findMany.mockResolvedValue([{ session_id: "session-1" }]);
    db.shiftSession.findUnique.mockResolvedValue(sessionRow);
    db.order.findFirst.mockResolvedValue(null);
    db.order.aggregate.mockResolvedValue({ _sum: { total_due: 15000 } });
    db.shiftSession.update.mockResolvedValue({ ...sessionRow, end_time: new Date() });

    const result = await repo.cashOutCurrent();

    expect(db.shiftSession.findUnique).toHaveBeenCalledWith({ where: { session_id: "session-1" } });
    expect(db.shiftSession.update).toHaveBeenCalledWith({
      where: { session_id: "session-1" },
      data: { end_time: expect.any(Date) },
      include: { cashier: true },
    });
    expect(result.gross_sales).toBe(15000);
  });

  it("throws UniqueException when more than one session is open — 'current' is ambiguous (NFR-011)", async () => {
    db.shiftSession.findMany.mockResolvedValue([{ session_id: "session-1" }, { session_id: "session-2" }]);

    await expect(repo.cashOutCurrent()).rejects.toThrow(UniqueException);
    expect(db.shiftSession.findUnique).not.toHaveBeenCalled();
  });

  it("throws UniqueException when the open session still has an order in progress", async () => {
    db.shiftSession.findMany.mockResolvedValue([{ session_id: "session-1" }]);
    db.shiftSession.findUnique.mockResolvedValue(sessionRow);
    db.order.findFirst.mockResolvedValue({ order_id: "order-1" });

    await expect(repo.cashOutCurrent()).rejects.toThrow(UniqueException);
  });
});

describe("ShiftSessionRepository.isOpenSession", () => {
  const repo = new ShiftSessionRepository();

  it("returns true for an open session", async () => {
    db.shiftSession.findUnique.mockResolvedValue({ end_time: null });
    await expect(repo.isOpenSession("session-1")).resolves.toBe(true);
  });

  it("returns false for a closed session", async () => {
    db.shiftSession.findUnique.mockResolvedValue({ end_time: new Date() });
    await expect(repo.isOpenSession("session-1")).resolves.toBe(false);
  });

  it("returns false when the session does not exist", async () => {
    db.shiftSession.findUnique.mockResolvedValue(null);
    await expect(repo.isOpenSession("missing")).resolves.toBe(false);
  });
});
