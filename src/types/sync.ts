import z from "zod";

export const OrderLineItemSyncSchema = z.object({
  product_id: z.number().int(),
  modifier_id: z.number().int().nullable().optional(),
  quantity: z.number().int().positive(),
  /** snapshot price at add-time, not looked up again on sync */
  unit_price: z.number().nonnegative(),
});

export const OrderSyncRecordSchema = z
  .object({
    /** client-generated (offline) — synced once; there is no edit-after-submit path */
    order_id: z.string().min(1),
    session_id: z.string().min(1),
    transaction_type: z.enum(["sale", "refund"]).optional(),
    order_type: z.enum(["dine_in", "take_out"]).nullable().optional(),
    status: z.enum(["open", "completed"]).optional(),
    /** LBP; negative for refunds */
    total_due: z.number(),
    cash_tendered: z.number().nonnegative().nullable().optional(),
    change_given: z.number().nullable().optional(),
    /** when the basket was opened on the device, not when it reaches the server */
    created_at: z.coerce.date(),
    completed_at: z.coerce.date().nullable().optional(),
    line_items: z.array(OrderLineItemSyncSchema),
  })
  .refine((data) => data.status !== "completed" || data.completed_at != null, {
    message: "completed_at is required when status is completed",
    path: ["completed_at"],
  });
export type OrderSyncRecord = z.infer<typeof OrderSyncRecordSchema>;

export const SyncRecordsRequestSchema = z.object({
  records: z.array(OrderSyncRecordSchema).min(1),
});
export type SyncRecordsRequest = z.infer<typeof SyncRecordsRequestSchema>;

export type SyncResult = {
  order_id: string;
  sync_status: "synced" | "failed";
  synced_at: Date | null;
};
