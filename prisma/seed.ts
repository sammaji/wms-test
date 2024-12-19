import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.transaction.deleteMany();
  await prisma.putawayBatch.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.item.deleteMany();
  await prisma.user.deleteMany();
  await prisma.location.deleteMany();
  await prisma.company.deleteMany();

  // Create test company
  const company = await prisma.company.create({
    data: {
      code: "TEST",
    },
  });

  // Create test locations
  const locations = await Promise.all([
    prisma.location.create({
      data: {
        label: "A-01-01",
        aisle: "A",
        bay: "01",
        height: "01",
        type: "STANDARD",
      },
    }),
    prisma.location.create({
      data: {
        label: "A-01-02",
        aisle: "A",
        bay: "01",
        height: "02",
        type: "STANDARD",
      },
    }),
  ]);

  // Create test user
  const user = await prisma.user.create({
    data: {
      username: "test",
      passwordHash: "test123", // In real app, this should be properly hashed
      role: UserRole.ADMIN,
      companyId: company.id,
    },
  });

  // Create test items
  const items = await Promise.all([
    prisma.item.create({
      data: {
        sku: "TEST001",
        name: "Test Item 1",
        barcode: "1234567890",
        companyId: company.id,
      },
    }),
    prisma.item.create({
      data: {
        sku: "TEST002",
        name: "Test Item 2",
        barcode: "0987654321",
        companyId: company.id,
      },
    }),
  ]);

  // Create test stock
  await Promise.all([
    prisma.stock.create({
      data: {
        itemId: items[0].id,
        locationId: locations[0].id,
        quantity: 10,
      },
    }),
    prisma.stock.create({
      data: {
        itemId: items[1].id,
        locationId: locations[1].id,
        quantity: 5,
      },
    }),
  ]);

  console.log("Database seeded successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

