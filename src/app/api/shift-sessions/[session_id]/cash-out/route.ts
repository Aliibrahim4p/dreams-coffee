import { NextRequest, NextResponse } from "next/server";
import { ShiftSessionService } from "@/services/shift-session-service";
import { handleRouteError } from "@/lib/handle-route-error";
import UnauthorizedException from "@/exceptions/unauthorized-exception";

type RouteParams = { params: Promise<{ session_id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { session_id } = await params;

  try {
    // The proxy only sets x-session-id on the session+panel path; an admin
    // token doesn't carry a session_id, so there's nothing to match there.
    const sessionIdFromToken = req.headers.get("x-session-id");
    if (sessionIdFromToken !== null && sessionIdFromToken !== session_id) {
      throw new UnauthorizedException("Session token does not match this session");
    }

    const result = await ShiftSessionService.cashOut(session_id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
