import { NextResponse } from "next/server";
import UniqueException from "@/exceptions/unique-exception";
import NotFoundException from "@/exceptions/not-found-exception";
import BadRequestException from "@/exceptions/bad-request-exception";
import UnauthorizedException from "@/exceptions/unauthorized-exception";
import logger from "@/util/logger";

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof UniqueException) {
    logger.warn("Route conflict: %s", error.message);
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof NotFoundException) {
    logger.info("Route not-found: %s", error.message);
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof BadRequestException) {
    logger.info("Route bad request: %s", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof UnauthorizedException) {
    logger.warn("Route unauthorized: %s", error.message);
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  logger.error("Unhandled route error: %s", error);
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
