import BadRequestException from "@/exceptions/bad-request-exception";
import { toBusinessDateFromInstant } from "@/lib/business-date";

export function parseDateParam(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid ${label}`);
  }
  return toBusinessDateFromInstant(date);
}
