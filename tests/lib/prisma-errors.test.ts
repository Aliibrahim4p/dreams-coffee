import { Prisma } from "@/app/generated/prisma/client";
import { isNotFoundError, isUniqueConstraintError } from "@/lib/prisma-errors";

function knownError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("boom", {
    code,
    clientVersion: "test",
    meta,
  });
}

describe("isUniqueConstraintError", () => {
  it("returns true for a P2002 error with no field filter", () => {
    expect(isUniqueConstraintError(knownError("P2002"))).toBe(true);
  });

  it("returns true when the field is among the violated targets", () => {
    const error = knownError("P2002", { target: ["name"] });
    expect(isUniqueConstraintError(error, "name")).toBe(true);
  });

  it("returns false when the field is not among the violated targets", () => {
    const error = knownError("P2002", { target: ["username"] });
    expect(isUniqueConstraintError(error, "name")).toBe(false);
  });

  it("returns false for a different Prisma error code", () => {
    expect(isUniqueConstraintError(knownError("P2025"))).toBe(false);
  });

  it("returns false for a plain Error", () => {
    expect(isUniqueConstraintError(new Error("boom"))).toBe(false);
  });
});

describe("isNotFoundError", () => {
  it("returns true for a P2025 error", () => {
    expect(isNotFoundError(knownError("P2025"))).toBe(true);
  });

  it("returns false for a different Prisma error code", () => {
    expect(isNotFoundError(knownError("P2002"))).toBe(false);
  });

  it("returns false for a plain Error", () => {
    expect(isNotFoundError(new Error("boom"))).toBe(false);
  });
});
