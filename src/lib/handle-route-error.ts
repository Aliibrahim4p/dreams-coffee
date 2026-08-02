import { NextResponse } from "next/server";
import UniqueException from "@/exceptions/unique-exception";
import NotFoundException from "@/exceptions/not-found-exception";
import BadRequestException from "@/exceptions/bad-request-exception";
import UnauthorizedException from "@/exceptions/unauthorized-exception";

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof UniqueException) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof NotFoundException) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof BadRequestException) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof UnauthorizedException) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
