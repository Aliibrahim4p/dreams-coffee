import { NextResponse } from "next/server";
import { StagingService } from "@/services/staging-service";
import { handleRouteError } from "@/lib/handle-route-error";
import StagingStorageException from "@/exceptions/staging-storage-exception";

export async function POST() {
  try {
    const processed = await StagingService.processStaged();
    return NextResponse.json({ processed }, { status: 200 });
  } catch (error) {
    if (error instanceof StagingStorageException) {
      return NextResponse.json({ code: "STAGING_STORAGE_UNAVAILABLE", message: error.message }, { status: 503 });
    }
    return handleRouteError(error);
  }
}
