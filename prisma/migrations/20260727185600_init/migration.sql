-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('recipe_based', 'reseller');

-- CreateEnum
CREATE TYPE "UnitOfMeasure" AS ENUM ('g', 'ml', 'piece');

-- CreateEnum
CREATE TYPE "CountFrequency" AS ENUM ('daily', 'monthly');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('dine_in', 'take_out');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('sale', 'refund');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('open', 'completed');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('pending', 'synced', 'failed');

-- CreateEnum
CREATE TYPE "PackType" AS ENUM ('box', 'bag_or_sleeve', 'default_unit');

-- CreateTable
CREATE TABLE "employee" (
    "pos_id" INTEGER NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,

    CONSTRAINT "employee_pkey" PRIMARY KEY ("pos_id")
);

-- CreateTable
CREATE TABLE "manager" (
    "manager_id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manager_pkey" PRIMARY KEY ("manager_id")
);

-- CreateTable
CREATE TABLE "terminal_unlock_session" (
    "unlock_id" SERIAL NOT NULL,
    "manager_id" INTEGER NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL,
    "unlocked_date" DATE NOT NULL,

    CONSTRAINT "terminal_unlock_session_pkey" PRIMARY KEY ("unlock_id")
);

-- CreateTable
CREATE TABLE "category" (
    "category_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "product" (
    "product_id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "base_price" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "size_modifier" (
    "modifier_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price_adjustment" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "size_modifier_pkey" PRIMARY KEY ("modifier_id")
);

-- CreateTable
CREATE TABLE "inventory_item" (
    "item_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL,
    "current_stock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "count_frequency" "CountFrequency" NOT NULL,
    "is_negative_flag" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "inventory_item_pkey" PRIMARY KEY ("item_id")
);

-- CreateTable
CREATE TABLE "supplier" (
    "supplier_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("supplier_id")
);

-- CreateTable
CREATE TABLE "app_config" (
    "config_key" TEXT NOT NULL,
    "config_value" TEXT NOT NULL,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("config_key")
);

-- CreateTable
CREATE TABLE "shift_session" (
    "session_id" TEXT NOT NULL,
    "cashier_pos_id" INTEGER NOT NULL,
    "starting_float" DECIMAL(65,30) NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "live_cash_total" DECIMAL(65,30) NOT NULL,
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'pending',
    "synced_at" TIMESTAMP(3),

    CONSTRAINT "shift_session_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "recipe" (
    "recipe_id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "modifier_id" INTEGER,

    CONSTRAINT "recipe_pkey" PRIMARY KEY ("recipe_id")
);

-- CreateTable
CREATE TABLE "pack_configuration" (
    "config_id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "pack_name" "PackType" NOT NULL,
    "base_unit_qty" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "pack_configuration_pkey" PRIMARY KEY ("config_id")
);

-- CreateTable
CREATE TABLE "delivery" (
    "delivery_id" TEXT NOT NULL,
    "manager_id" INTEGER NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "date_received" DATE NOT NULL,
    "notes" TEXT,
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'pending',
    "synced_at" TIMESTAMP(3),

    CONSTRAINT "delivery_pkey" PRIMARY KEY ("delivery_id")
);

-- CreateTable
CREATE TABLE "delivery_line_item" (
    "delivery_id" TEXT NOT NULL,
    "item_id" INTEGER NOT NULL,
    "config_id" INTEGER NOT NULL,
    "qty_received" DECIMAL(65,30) NOT NULL,
    "cost_per_unit" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "delivery_line_item_pkey" PRIMARY KEY ("delivery_id","item_id","config_id")
);

-- CreateTable
CREATE TABLE "inventory_count_entry" (
    "count_id" TEXT NOT NULL,
    "item_id" INTEGER NOT NULL,
    "manager_id" INTEGER NOT NULL,
    "physical_count" DECIMAL(65,30) NOT NULL,
    "entry_date" DATE NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'pending',
    "synced_at" TIMESTAMP(3),

    CONSTRAINT "inventory_count_entry_pkey" PRIMARY KEY ("count_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "order_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "transaction_type" "TransactionType" NOT NULL DEFAULT 'sale',
    "order_type" "OrderType",
    "status" "OrderStatus" NOT NULL DEFAULT 'open',
    "total_due" DECIMAL(65,30) NOT NULL,
    "cash_tendered" DECIMAL(65,30),
    "change_given" DECIMAL(65,30),
    "created_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'pending',
    "synced_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "recipe_ingredient" (
    "recipe_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL,

    CONSTRAINT "recipe_ingredient_pkey" PRIMARY KEY ("recipe_id","item_id")
);

-- CreateTable
CREATE TABLE "order_line_item" (
    "line_item_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "modifier_id" INTEGER,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "order_line_item_pkey" PRIMARY KEY ("line_item_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manager_username_key" ON "manager"("username");

-- CreateIndex
CREATE UNIQUE INDEX "category_name_key" ON "category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_item_name_key" ON "inventory_item"("name");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_product_id_modifier_id_key" ON "recipe"("product_id", "modifier_id");

-- CreateIndex
CREATE UNIQUE INDEX "pack_configuration_item_id_pack_name_key" ON "pack_configuration"("item_id", "pack_name");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_count_entry_item_id_entry_date_key" ON "inventory_count_entry"("item_id", "entry_date");

-- CreateIndex
CREATE INDEX "orders_session_id_status_idx" ON "orders"("session_id", "status");

-- AddForeignKey
ALTER TABLE "terminal_unlock_session" ADD CONSTRAINT "terminal_unlock_session_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "manager"("manager_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_session" ADD CONSTRAINT "shift_session_cashier_pos_id_fkey" FOREIGN KEY ("cashier_pos_id") REFERENCES "employee"("pos_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_modifier_id_fkey" FOREIGN KEY ("modifier_id") REFERENCES "size_modifier"("modifier_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_configuration" ADD CONSTRAINT "pack_configuration_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_item"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery" ADD CONSTRAINT "delivery_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "manager"("manager_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery" ADD CONSTRAINT "delivery_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_line_item" ADD CONSTRAINT "delivery_line_item_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "pack_configuration"("config_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_line_item" ADD CONSTRAINT "delivery_line_item_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "delivery"("delivery_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_line_item" ADD CONSTRAINT "delivery_line_item_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_item"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_entry" ADD CONSTRAINT "inventory_count_entry_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_item"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_entry" ADD CONSTRAINT "inventory_count_entry_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "manager"("manager_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "shift_session"("session_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_item"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipe"("recipe_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_item" ADD CONSTRAINT "order_line_item_modifier_id_fkey" FOREIGN KEY ("modifier_id") REFERENCES "size_modifier"("modifier_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_item" ADD CONSTRAINT "order_line_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_item" ADD CONSTRAINT "order_line_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;
