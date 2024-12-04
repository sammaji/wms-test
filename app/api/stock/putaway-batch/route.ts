import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { TransactionType } from "@prisma/client"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { locationLabel, items } = body

    if (!locationLabel || !items || !Array.isArray(items)) {
      return new NextResponse("Invalid request body", { status: 400 })
    }

    // Get the location
    const location = await prisma.location.findFirst({
      where: {
        label: locationLabel,
      },
    })

    if (!location) {
      return new NextResponse("Location not found", { status: 404 })
    }

    // Create all putaway transactions in a transaction
    const result = await prisma.$transaction(async (prismaClient) => {
      const transactions = []

      for (const item of items) {
        const { itemId, quantity } = item

        // Get the item
        const dbItem = await prismaClient.item.findUnique({
          where: {
            id: itemId,
          },
        })

        if (!dbItem) {
          throw new Error(`Item ${itemId} not found`)
        }

        // Create the putaway transaction
        const transaction = await prismaClient.transaction.create({
          data: {
            type: TransactionType.ADD,
            quantity,
            item: {
              connect: {
                id: itemId,
              },
            },
            toLocation: {
              connect: {
                id: location.id,
              },
            },
          },
        })

        // Update or create stock record
        const existingStock = await prismaClient.stock.findUnique({
          where: {
            itemId_locationId: {
              itemId: itemId,
              locationId: location.id,
            },
          },
        })

        if (existingStock) {
          // Update existing stock
          await prismaClient.stock.update({
            where: {
              id: existingStock.id,
            },
            data: {
              quantity: existingStock.quantity + quantity,
            },
          })
        } else {
          // Create new stock record
          await prismaClient.stock.create({
            data: {
              quantity,
              item: {
                connect: {
                  id: itemId,
                },
              },
              location: {
                connect: {
                  id: location.id,
                },
              },
            },
          })
        }

        transactions.push(transaction)
      }

      return transactions
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[PUTAWAY_BATCH]", error)
    return new NextResponse(error instanceof Error ? error.message : "Internal error", { status: 500 })
  }
} 