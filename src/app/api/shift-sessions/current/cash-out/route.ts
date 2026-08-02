import { NextResponse } from "next/server";
import { ShiftSessionService } from "@/services/shift-session-service";
import { handleRouteError } from "@/lib/handle-route-error";

export async function POST() {
  try {
    const result = await ShiftSessionService.cashOutCurrent();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
