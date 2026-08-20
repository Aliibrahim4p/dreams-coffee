import { Prisma } from "@/app/generated/prisma/client";

// Under the classic query engine, P2002's offending column(s) are at `meta.target`.
// Under `@prisma/adapter-pg` (driver adapters), Prisma instead nests the raw
// Postgres constraint info at `meta.driverAdapterError.cause.constraint.fields`
// and never populates `meta.target` at all — so both shapes must be checked.
function uniqueConstraintFields(meta: Record<string, unknown> | undefined): string[] {
  const target = meta?.target;
  if (Array.isArray(target)) return target as string[];
  if (typeof target === "string") return [target];

  const driverFields = (
    meta as
      | { driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } }
      | undefined
  )?.driverAdapterError?.cause?.constraint?.fields;
  return Array.isArray(driverFields) ? (driverFields as string[]) : [];
}

export function isUniqueConstraintError(error: unknown, field?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  if (!field) return true;
  return uniqueConstraintFields(error.meta).includes(field);
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}
