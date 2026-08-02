import BadRequestException from "@/exceptions/bad-request-exception";

export function parseIdParam(value: string, label: string): number {
  const id = value.trim() === "" ? NaN : Number(value);
  if (!Number.isInteger(id)) {
    throw new BadRequestException(`Invalid ${label}`);
  }
  return id;
}
