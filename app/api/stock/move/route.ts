import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sourceBay, destinationBay, items } = body

    if (!sourceBay || !destinationBay || !items || !Array.isArray(items)) {
      return new NextResponse("Invalid request body", { status: 400 })
    }

    // Start a transaction to ensure all operations succeed or none do
    const result = await prisma.$transaction(async (tx) => {
      // Find source and destination locations
      const sourceLocation = await tx.location.findFirst({
        where: {
          label: {
            equals: sourceBay,
            mode: 'insensitive'
          }
        }
      })

      const destinationLocation = await tx.location.findFirst({
        where: {
          label: {
            equals: destinationBay,
            mode: 'insensitive'
          }
        }
      })

      if (!sourceLocation || !destinationLocation) {
        throw new Error("Source or destination location not found")
      }

      const movedItems = []

      for (const { stockId, quantity } of items) {
        // Get current stock
        const currentStock = await tx.stock.findUnique({
          where: { id: stockId },
          include: { item: true }
        })

        if (!currentStock) {
          throw new Error(`Stock with ID ${stockId} not found`)
        }

        // Check if stock already exists in destination
        let destinationStock = await tx.stock.findFirst({
          where: {
            itemId: currentStock.itemId,
            locationId: destinationLocation.id
          }
        })

        // If stock exists in destination, update quantity
        if (destinationStock) {
          destinationStock = await tx.stock.update({
            where: { id: destinationStock.id },
            data: {
              quantity: { increment: quantity }
            }
          })
        } else {
          // Create new stock in destination
          destinationStock = await tx.stock.create({
            data: {
              itemId: currentStock.itemId,
              locationId: destinationLocation.id,
              quantity: quantity
            }
          })
        }

        // Update source stock quantity
        await tx.stock.update({
          where: { id: stockId },
          data: {
            quantity: { decrement: quantity }
          }
        })

        // Create transaction record
        await tx.transaction.create({
          data: {
            type: "MOVE",
            quantity: quantity,
            itemId: currentStock.itemId,
            fromLocationId: sourceLocation.id,
            toLocationId: destinationLocation.id
          }
        })

        movedItems.push(destinationStock)
      }

      return movedItems
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error moving stock:", error)
    return new NextResponse(
      error instanceof Error ? error.message : "Internal Server Error",
      { status: 500 }
    )
  }
} 