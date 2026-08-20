import { NextRequest, NextResponse } from "next/server";

export type ParsedBody =
  | { success: true; data: unknown }
  | { success: false; response: NextResponse };

export async function parseJsonBody(req: NextRequest): Promise<ParsedBody> {
  try {
    return { success: true, data: await req.json() };
  } catch {
    return {
      success: false,
      response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }
}
