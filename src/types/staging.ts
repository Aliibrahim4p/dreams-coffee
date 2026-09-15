import z from "zod";

export const StagingLineItemSchema = z.object({
  product_id: z.number().int(),
  modifier_id: z.number().int().nullable().optional(),
  /** client-computed, offline — cross-checked against the current catalog price at process time */
  unit_price: z.number().nonnegative(),
});

export const StagingOrderRecordSchema = z
  .object({
    order_id: z.string().min(1),
    session_id: z.string().min(1),
    transaction_type: z.enum(["sale", "refund"]).optional(),
    /** required for a sale, forbidden for a refund — that cross-field rule is checked at
     * process time (INVALID_ORDER_TYPE), not here, so a record missing it still stages fine */
    order_type: z.enum(["dine_in", "take_out"]).nullable().optional(),
    status: z.enum(["open", "completed"]).optional(),
    cash_tendered: z.number().nonnegative().nullable().optional(),
    change_given: z.number().nullable().optional(),
    created_at: z.coerce.date(),
    completed_at: z.coerce.date().nullable().optional(),
    line_items: z.array(StagingLineItemSchema).min(1),
  })
  .refine((data) => data.status !== "completed" || data.completed_at != null, {
    message: "completed_at is required when status is completed",
    path: ["completed_at"],
  });
export type StagingOrderRecord = z.infer<typeof StagingOrderRecordSchema>;

export const StagingRequestSchema = z.object({
  records: z.array(StagingOrderRecordSchema).min(1),
});
export type StagingRequest = z.infer<typeof StagingRequestSchema>;

// Staging can only fail on a genuine storage problem — no business validation happens here.
export type StageResult =
  | { order_id: string; staged: true; key: string }
  | { order_id: string; staged: false; code: "STAGING_STORAGE_UNAVAILABLE"; message: string };

// Processing owns every other failure mode: price validation, cash reconciliation, and the
// actual sync all happen here.
export type ProcessedOrderResult =
  | { key: string; order_id: string; outcome: "synced" | "already_synced"; synced_at: Date | null }
  | {
      key: string;
      order_id: string;
      outcome: "failed";
      code?:
        | "INVALID_SESSION"
        | "INVALID_ORDER_TYPE"
        | "PRODUCT_NOT_FOUND"
        | "INVALID_MODIFIER"
        | "PRICE_MISMATCH"
        | "CASH_TOTAL_MISMATCH";
      message?: string;
    }
  | { key: string; order_id: string | null; code: "STAGED_BLOB_CORRUPT" | "STAGING_STORAGE_UNAVAILABLE"; message: string };
