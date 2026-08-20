import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "@/lib/password";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const today = new Date("2026-07-28T08:00:00Z");
const yesterday = new Date("2026-07-27T08:00:00Z");

async function main() {
  // ---------- Clear existing data (FK-safe order) so this script is re-runnable ----------
  await prisma.orderLineItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.shiftSession.deleteMany();
  await prisma.inventoryCountEntry.deleteMany();
  await prisma.deliveryLineItem.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.packConfiguration.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.sizeModifier.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.appConfig.deleteMany();
  await prisma.terminalUnlockSession.deleteMany();
  await prisma.manager.deleteMany();
  await prisma.employee.deleteMany();

  // ---------- Managers ----------
  // Login credentials for manual testing: admin / Admin123! and rghosn / Shift123!
  const admin = await prisma.manager.create({
    data: {
      username: "admin",
      password_hash: await hashPassword("Admin123!"),
      first_name: "Admin",
      last_name: "User",
      created_at: today,
    },
  });
  const shiftManager = await prisma.manager.create({
    data: {
      username: "rghosn",
      password_hash: await hashPassword("Shift123!"),
      first_name: "Rania",
      last_name: "Ghosn",
      created_at: yesterday,
    },
  });

  // ---------- Employees (cashiers) ----------
  const john = await prisma.employee.create({
    data: { pos_id: 1, first_name: "John", last_name: "Doe" },
  });
  const jane = await prisma.employee.create({
    data: { pos_id: 2, first_name: "Jane", last_name: "Smith" },
  });

  // ---------- Terminal unlock sessions ----------
  await prisma.terminalUnlockSession.create({
    data: {
      manager_id: admin.manager_id,
      unlocked_at: today,
      unlocked_date: today,
    },
  });
  await prisma.terminalUnlockSession.create({
    data: {
      manager_id: shiftManager.manager_id,
      unlocked_at: yesterday,
      unlocked_date: yesterday,
    },
  });

  // ---------- App config ----------
  // Manager PIN for manual testing: 1234
  await prisma.appConfig.create({
    data: {
      config_key: "manager_pin",
      config_value: await hashPassword("1234"),
    },
  });
  await prisma.appConfig.create({
    data: { config_key: "exchange_rate", config_value: "89500" },
  });

  // ---------- Categories ----------
  const coffeeCategory = await prisma.category.create({
    data: { name: "Coffee" },
  });
  const pastryCategory = await prisma.category.create({
    data: { name: "Pastries" },
  });
  const retailCategory = await prisma.category.create({
    data: { name: "Retail" },
  });

  // ---------- Size modifiers ----------
  const small = await prisma.sizeModifier.create({
    data: { name: "Small", price_adjustment: 0 },
  });
  const medium = await prisma.sizeModifier.create({
    data: { name: "Medium", price_adjustment: 2000 },
  });
  const large = await prisma.sizeModifier.create({
    data: { name: "Large", price_adjustment: 4000 },
  });

  // ---------- Products ----------
  const espresso = await prisma.product.create({
    data: {
      category_id: coffeeCategory.category_id,
      name: "Espresso",
      type: "recipe_based",
      base_price: 100000,
    },
  });
  const latte = await prisma.product.create({
    data: {
      category_id: coffeeCategory.category_id,
      name: "Latte",
      type: "recipe_based",
      base_price: 130000,
    },
  });
  const croissant = await prisma.product.create({
    data: {
      category_id: pastryCategory.category_id,
      name: "Croissant",
      type: "reseller",
      base_price: 90000,
    },
  });
  const bottledWater = await prisma.product.create({
    data: {
      category_id: retailCategory.category_id,
      name: "Bottled Water",
      type: "reseller",
      base_price: 40000,
    },
  });

  // ---------- Inventory items ----------
  const espressoBeans = await prisma.inventoryItem.create({
    data: {
      name: "Espresso Beans",
      unit: "g",
      current_stock: 5000,
      count_frequency: "daily",
      is_negative_flag: false,
    },
  });
  const milk = await prisma.inventoryItem.create({
    data: {
      name: "Milk",
      unit: "ml",
      current_stock: 12000,
      count_frequency: "daily",
      is_negative_flag: false,
    },
  });
  const sugar = await prisma.inventoryItem.create({
    data: {
      name: "Sugar",
      unit: "g",
      current_stock: 50000,
      count_frequency: "monthly",
      is_negative_flag: false,
    },
  });
  const croissantUnit = await prisma.inventoryItem.create({
    data: {
      name: "Croissant Unit",
      unit: "piece",
      current_stock: 40,
      count_frequency: "daily",
      is_negative_flag: false,
    },
  });
  const bottledWaterUnit = await prisma.inventoryItem.create({
    data: {
      name: "Bottled Water Unit",
      unit: "piece",
      current_stock: -3,
      count_frequency: "monthly",
      is_negative_flag: true,
    },
  });

  // ---------- Suppliers ----------
  const activeSupplier = await prisma.supplier.create({
    data: { name: "Lebanese Coffee Co", is_active: true },
  });
  const inactiveSupplier = await prisma.supplier.create({
    data: { name: "Old Roasters Inc", is_active: false },
  });
  const metroDairySupplier = await prisma.supplier.create({
    data: { name: "Metro Dairy", is_active: true },
  });

  // ---------- Pack configurations ----------
  const beansBox = await prisma.packConfiguration.create({
    data: {
      item_id: espressoBeans.item_id,
      pack_name: "box",
      base_unit_qty: 5000,
    },
  });
  const milkBox = await prisma.packConfiguration.create({
    data: { item_id: milk.item_id, pack_name: "box", base_unit_qty: 12000 },
  });
  const sugarBag = await prisma.packConfiguration.create({
    data: {
      item_id: sugar.item_id,
      pack_name: "bag_or_sleeve",
      base_unit_qty: 50000,
    },
  });
  const croissantUnitPack = await prisma.packConfiguration.create({
    data: {
      item_id: croissantUnit.item_id,
      pack_name: "default_unit",
      base_unit_qty: 1,
    },
  });
  const waterCase = await prisma.packConfiguration.create({
    data: {
      item_id: bottledWaterUnit.item_id,
      pack_name: "box",
      base_unit_qty: 24,
    },
  });

  // ---------- Recipes + ingredients ----------
  // Espresso: two sizes, standard positive deductions
  await prisma.recipe.create({
    data: {
      product_id: espresso.product_id,
      modifier_id: small.modifier_id,
      ingredients: {
        create: [
          { item_id: espressoBeans.item_id, quantity: 18, unit: "g" },
          { item_id: milk.item_id, quantity: 30, unit: "ml" },
        ],
      },
    },
  });
  await prisma.recipe.create({
    data: {
      product_id: espresso.product_id,
      modifier_id: medium.modifier_id,
      ingredients: {
        create: [
          { item_id: espressoBeans.item_id, quantity: 18, unit: "g" },
          { item_id: milk.item_id, quantity: 60, unit: "ml" },
        ],
      },
    },
  });

  // Latte: three sizes; Large includes a negative-quantity ingredient
  // (represents a promo adjustment that returns stock, per schema note that
  // recipe_ingredient.quantity "can be negative")
  await prisma.recipe.create({
    data: {
      product_id: latte.product_id,
      modifier_id: small.modifier_id,
      ingredients: {
        create: [
          { item_id: espressoBeans.item_id, quantity: 18, unit: "g" },
          { item_id: milk.item_id, quantity: 150, unit: "ml" },
        ],
      },
    },
  });
  await prisma.recipe.create({
    data: {
      product_id: latte.product_id,
      modifier_id: medium.modifier_id,
      ingredients: {
        create: [
          { item_id: espressoBeans.item_id, quantity: 18, unit: "g" },
          { item_id: milk.item_id, quantity: 250, unit: "ml" },
        ],
      },
    },
  });
  await prisma.recipe.create({
    data: {
      product_id: latte.product_id,
      modifier_id: large.modifier_id,
      ingredients: {
        create: [
          { item_id: espressoBeans.item_id, quantity: 18, unit: "g" },
          { item_id: milk.item_id, quantity: 350, unit: "ml" },
          { item_id: sugar.item_id, quantity: -2, unit: "g" },
        ],
      },
    },
  });

  // Reseller products: no size (modifier_id null), quantity always 1
  await prisma.recipe.create({
    data: {
      product_id: croissant.product_id,
      modifier_id: null,
      ingredients: {
        create: [
          { item_id: croissantUnit.item_id, quantity: 1, unit: "piece" },
        ],
      },
    },
  });
  await prisma.recipe.create({
    data: {
      product_id: bottledWater.product_id,
      modifier_id: null,
      ingredients: {
        create: [
          { item_id: bottledWaterUnit.item_id, quantity: 1, unit: "piece" },
        ],
      },
    },
  });

  // ---------- Deliveries ----------
  await prisma.delivery.create({
    data: {
      manager_id: admin.manager_id,
      supplier_id: activeSupplier.supplier_id,
      date_received: today,
      notes: null,
      sync_status: "synced",
      synced_at: today,
      line_items: {
        create: [
          {
            item_id: espressoBeans.item_id,
            config_id: beansBox.config_id,
            qty_received: 3,
            cost_per_unit: 2500000,
          },
          {
            item_id: milk.item_id,
            config_id: milkBox.config_id,
            qty_received: 5,
            cost_per_unit: 900000,
          },
        ],
      },
    },
  });
  await prisma.delivery.create({
    data: {
      manager_id: shiftManager.manager_id,
      supplier_id: metroDairySupplier.supplier_id,
      date_received: yesterday,
      notes: "2 bags damaged in transit",
      sync_status: "pending",
      synced_at: null,
      line_items: {
        create: [
          {
            item_id: sugar.item_id,
            config_id: sugarBag.config_id,
            qty_received: 2,
            cost_per_unit: 1500000,
          },
        ],
      },
    },
  });
  await prisma.delivery.create({
    data: {
      manager_id: admin.manager_id,
      supplier_id: inactiveSupplier.supplier_id,
      date_received: yesterday,
      notes: "Retry sync failed",
      sync_status: "failed",
      synced_at: null,
      line_items: {
        create: [
          {
            item_id: bottledWaterUnit.item_id,
            config_id: waterCase.config_id,
            qty_received: 4,
            cost_per_unit: 480000,
          },
          {
            item_id: croissantUnit.item_id,
            config_id: croissantUnitPack.config_id,
            qty_received: 20,
            cost_per_unit: 60000,
          },
        ],
      },
    },
  });

  // ---------- Inventory count entries ----------
  await prisma.inventoryCountEntry.create({
    data: {
      item_id: espressoBeans.item_id,
      manager_id: admin.manager_id,
      physical_count: 4800,
      entry_date: today,
      is_locked: false,
      sync_status: "pending",
      synced_at: null,
    },
  });
  await prisma.inventoryCountEntry.create({
    data: {
      item_id: milk.item_id,
      manager_id: shiftManager.manager_id,
      physical_count: 11500,
      entry_date: yesterday,
      is_locked: true,
      sync_status: "synced",
      synced_at: yesterday,
    },
  });
  await prisma.inventoryCountEntry.create({
    data: {
      item_id: sugar.item_id,
      manager_id: admin.manager_id,
      physical_count: 49000,
      entry_date: today,
      is_locked: false,
      sync_status: "failed",
      synced_at: null,
    },
  });

  // ---------- Shift sessions + orders ----------
  // Closed shift (Jane, yesterday) with completed sale, take-out sale, and a refund
  const closedSession = await prisma.shiftSession.create({
    data: {
      cashier_pos_id: jane.pos_id,
      starting_float: 300000,
      start_time: yesterday,
      end_time: new Date("2026-07-27T18:00:00Z"),
      live_cash_total: 654000,
      sync_status: "synced",
      synced_at: new Date("2026-07-27T18:05:00Z"),
    },
  });

  const latteMediumPrice = 130000 + 2000; // base_price + medium adjustment snapshot
  const espressoSmallPrice = 100000 + 0;
  const croissantPrice = 90000;
  const bottledWaterPrice = 40000;

  await prisma.order.create({
    data: {
      session_id: closedSession.session_id,
      transaction_type: "sale",
      order_type: "dine_in",
      status: "completed",
      total_due: latteMediumPrice * 2 + croissantPrice,
      cash_tendered: 400000,
      change_given: 400000 - (latteMediumPrice * 2 + croissantPrice),
      created_at: new Date("2026-07-27T10:00:00Z"),
      completed_at: new Date("2026-07-27T10:05:00Z"),
      sync_status: "synced",
      synced_at: new Date("2026-07-27T18:05:00Z"),
      line_items: {
        create: [
          {
            product_id: latte.product_id,
            modifier_id: medium.modifier_id,
            quantity: 2,
            unit_price: latteMediumPrice,
          },
          {
            product_id: croissant.product_id,
            modifier_id: null,
            quantity: 1,
            unit_price: croissantPrice,
          },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      session_id: closedSession.session_id,
      transaction_type: "sale",
      order_type: "take_out",
      status: "completed",
      total_due: espressoSmallPrice + bottledWaterPrice * 2,
      cash_tendered: 200000,
      change_given: 200000 - (espressoSmallPrice + bottledWaterPrice * 2),
      created_at: new Date("2026-07-27T11:00:00Z"),
      completed_at: new Date("2026-07-27T11:03:00Z"),
      sync_status: "pending",
      synced_at: null,
      line_items: {
        create: [
          {
            product_id: espresso.product_id,
            modifier_id: small.modifier_id,
            quantity: 1,
            unit_price: espressoSmallPrice,
          },
          {
            product_id: bottledWater.product_id,
            modifier_id: null,
            quantity: 2,
            unit_price: bottledWaterPrice,
          },
        ],
      },
    },
  });

  // Refund: no order_type, negative total_due
  await prisma.order.create({
    data: {
      session_id: closedSession.session_id,
      transaction_type: "refund",
      order_type: null,
      status: "completed",
      total_due: -latteMediumPrice,
      cash_tendered: -latteMediumPrice,
      change_given: 0,
      created_at: new Date("2026-07-27T15:00:00Z"),
      completed_at: new Date("2026-07-27T15:02:00Z"),
      sync_status: "synced",
      synced_at: new Date("2026-07-27T18:05:00Z"),
      line_items: {
        create: [
          {
            product_id: latte.product_id,
            modifier_id: medium.modifier_id,
            quantity: 1,
            unit_price: latteMediumPrice,
          },
        ],
      },
    },
  });

  // Open shift (John, today) — the session itself is deliberately left open (end_time:
  // null) for manual testing of the shift-session endpoints (cash-out, etc.), but its
  // order is completed rather than left open: there's no API to complete/clear an
  // existing order (the `/orders` resource isn't built yet), so a genuinely open order
  // here would permanently block cashing this session out via the real API. The
  // "order still open" cash-out rejection is already covered by
  // shift-session-repository.test.ts with mocked data.
  const openSession = await prisma.shiftSession.create({
    data: {
      cashier_pos_id: john.pos_id,
      starting_float: 500000,
      start_time: today,
      end_time: null,
      live_cash_total: 500000,
      sync_status: "pending",
      synced_at: null,
    },
  });

  const espressoMediumPrice = 100000 + 2000;
  const latteLargePrice = 130000 + 4000;

  await prisma.order.create({
    data: {
      session_id: openSession.session_id,
      transaction_type: "sale",
      order_type: "dine_in",
      status: "completed",
      total_due: espressoMediumPrice + latteLargePrice,
      cash_tendered: 300000,
      change_given: 300000 - (espressoMediumPrice + latteLargePrice),
      created_at: new Date("2026-07-28T09:00:00Z"),
      completed_at: new Date("2026-07-28T09:04:00Z"),
      sync_status: "pending",
      synced_at: null,
      line_items: {
        create: [
          {
            product_id: espresso.product_id,
            modifier_id: medium.modifier_id,
            quantity: 1,
            unit_price: espressoMediumPrice,
          },
          {
            product_id: latte.product_id,
            modifier_id: large.modifier_id,
            quantity: 1,
            unit_price: latteLargePrice,
          },
        ],
      },
    },
  });
}

main()
  .then(async () => {
    console.log("Seeding completed.");
  })
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
