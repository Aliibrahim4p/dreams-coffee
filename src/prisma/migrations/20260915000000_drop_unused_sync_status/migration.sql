-- ShiftSession, Delivery, and InventoryCountEntry are only ever created live (each requires
-- a connectivity-gated token to reach), so unlike Order there's no genuine
-- offline-queued-then-synced state for them to track. Neither column was ever meaningfully
-- read or written for these three tables.

-- AlterTable
ALTER TABLE "shift_session" DROP COLUMN "sync_status",
DROP COLUMN "synced_at";

-- AlterTable
ALTER TABLE "delivery" DROP COLUMN "sync_status",
DROP COLUMN "synced_at";

-- AlterTable
ALTER TABLE "inventory_count_entry" DROP COLUMN "sync_status",
DROP COLUMN "synced_at";
