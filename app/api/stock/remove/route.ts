import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { items, bayCode } = body

    if (!items || !Array.isArray(items) || items.length === 0 || !bayCode) {
      return new NextResponse("Invalid request body", { status: 400 })
    }

    // Start a transaction to ensure all operations succeed or none do
    const result = await prisma.$transaction(async (tx) => {
      // First find the location
      const location = await tx.location.findFirst({
        where: {
          label: {
            equals: bayCode,
            mode: 'insensitive'
          }
        }
      })

      if (!location) {
        throw new Error(`Location ${bayCode} not found`)
      }

      const removedItems = []

      for (const { stockId, quantity } of items) {
        // Get current stock
        const currentStock = await tx.stock.findUnique({
          where: { id: stockId },
          include: { item: true }
        })

        if (!currentStock) {
          throw new Error(`Stock with ID ${stockId} not found`)
        }

        if (currentStock.quantity < quantity) {
          throw new Error(`Insufficient quantity for ${currentStock.item.sku}`)
        }

        // Update stock quantity
        const updatedStock = await tx.stock.update({
          where: { id: stockId },
          data: { 
            quantity: { decrement: quantity }
          },
          include: { item: true }
        })

        // Create transaction record
        await tx.transaction.create({
          data: {
            type: "REMOVE",
            quantity: quantity,
            itemId: currentStock.itemId,
            fromLocationId: location.id
          }
        })

        removedItems.push(updatedStock)
      }

      return removedItems
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error removing stock:", error)
    return new NextResponse(
      error instanceof Error ? error.message : "Internal Server Error",
      { status: 500 }
    )
  }
} 