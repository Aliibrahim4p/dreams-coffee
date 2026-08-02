import { NextRequest, NextResponse } from "next/server";
import { DeliveryService } from "@/services/delivery-service";
import { handleRouteError } from "@/lib/handle-route-error";

type RouteParams = { params: Promise<{ delivery_id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { delivery_id } = await params;

  try {
    const delivery = await DeliveryService.getDelivery(delivery_id);
    return NextResponse.json(delivery, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
