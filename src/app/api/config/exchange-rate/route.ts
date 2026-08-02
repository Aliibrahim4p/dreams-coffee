import { NextRequest, NextResponse } from "next/server";
import { ExchangeRateUpdateSchema } from "@/types/exchange-rate";
import { ExchangeRateService } from "@/services/exchange-rate-service";
import { validateBody } from "@/lib/validate-body";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleRouteError } from "@/lib/handle-route-error";

export async function GET() {
  try {
    const rate = await ExchangeRateService.getExchangeRate();
    return NextResponse.json(rate, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(req: NextRequest) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.success) return parsedBody.response;

  const validation = validateBody(ExchangeRateUpdateSchema, parsedBody.data);
  if (!validation.success) return validation.response;

  try {
    const rate = await ExchangeRateService.updateExchangeRate(validation.data.rate_value);
    return NextResponse.json(rate, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
