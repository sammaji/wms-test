import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const whereClause: any = {};
    if (type) whereClause.type = type;
    if (status) whereClause.status = status;
    if (startDate || endDate) {
      whereClause.createdAt = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      };
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        item: {
          select: {
            sku: true,
            name: true,
          },
        },
        fromLocation: {
          select: {
            label: true,
          },
        },
        toLocation: {
          select: {
            label: true,
          },
        },
        user: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const data = transactions.map((transaction) => ({
      id: transaction.id,
      date: transaction.createdAt.toString(),
      type: transaction.type,
      quantity: transaction.quantity,
      sku: transaction.item.sku,
      itemName: transaction.item.name,
      fromLocation: transaction.fromLocation?.label,
      toLocation: transaction.toLocation?.label,
    }));
    return NextResponse.json({ data }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 400 },
    );
  }
}
