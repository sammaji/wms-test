import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params: { transactionId } }: { params: { transactionId: string } },
) {
  const userId = req.nextUrl.searchParams.get("userId");

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      item: true,
      fromLocation: true,
      toLocation: true,
    },
  });

  if (!transaction || transaction.status === "UNDONE") {
    throw new Error("Transaction cannot be undone");
  }

  const fromStock = await prisma.stock.findUnique({
    where: {
      itemId_locationId: {
        itemId: transaction.itemId,
        locationId: transaction.fromLocationId ?? "",
      },
    },
  });

  const toStock = await prisma.stock.findUnique({
    where: {
      itemId_locationId: {
        itemId: transaction.itemId,
        locationId: transaction.toLocationId ?? "",
      },
    },
  });

  if (!fromStock || !toStock) {
    throw new Error("Undoing this transaction would result in negative stock");
  }

  const newFromStockQuantity = fromStock.quantity + transaction.quantity;
  const newToStockQuantity = toStock.quantity - transaction.quantity;

  if (newFromStockQuantity < 0 || newToStockQuantity < 0) {
    throw new Error("Undoing this transaction would result in negative stock");
  }

  const addStock = prisma.stock.update({
    where: {
      itemId_locationId: {
        itemId: transaction.itemId,
        locationId: transaction.fromLocationId ?? "",
      },
    },
    data: { quantity: newFromStockQuantity },
  });

  const removeStock = prisma.stock.update({
    where: {
      itemId_locationId: {
        itemId: transaction.itemId,
        locationId: transaction.toLocationId ?? "",
      },
    },
    data: { quantity: newToStockQuantity },
  });

  const transactionLog = prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: "UNDONE",
      undoneBy: userId,
    },
  });

  const result = await prisma.$transaction([
    removeStock,
    addStock,
    transactionLog,
  ]);

  return NextResponse.json({ result }, { status: 200 });
}
