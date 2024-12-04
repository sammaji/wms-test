import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

// Update dependencies check to include transactions
async function getItemDependencies(itemId: string) {
  const [stockCount, transactionCount] = await Promise.all([
    prisma.stock.count({
      where: { itemId }
    }),
    prisma.transaction.count({
      where: { itemId }
    })
  ])

  return {
    stockCount,
    transactionCount
  }
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const dependencies = await getItemDependencies(params.id)
    return NextResponse.json(dependencies)
  } catch (error) {
    console.error("[ITEM_DEPENDENCIES]", error)
    return new NextResponse("Internal error", { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Use a transaction to ensure all deletes succeed or none do
    await prisma.$transaction(async (tx) => {
      // Delete all related transactions first
      await tx.transaction.deleteMany({
        where: { itemId: params.id }
      })

      // Then delete all related stock records
      await tx.stock.deleteMany({
        where: { itemId: params.id }
      })

      // Finally delete the item
      await tx.item.delete({
        where: { id: params.id }
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[ITEM_DELETE]", error)
    return new NextResponse("Internal error", { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { sku, name, barcode } = body

    const item = await prisma.item.update({
      where: {
        id: params.id
      },
      data: {
        sku,
        name,
        barcode
      }
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error("[ITEM_UPDATE]", error)
    return new NextResponse("Internal error", { status: 500 })
  }
} 