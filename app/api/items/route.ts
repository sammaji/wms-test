import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { barcode, sku, name } = body

    // Validate input
    if (!barcode || !sku || !name) {
      return new NextResponse("Missing required fields", { status: 400 })
    }

    // Check if barcode or SKU already exists
    const existing = await prisma.item.findFirst({
      where: {
        OR: [
          { barcode },
          { sku }
        ]
      }
    })

    if (existing) {
      return new NextResponse(
        `Item with this ${existing.barcode === barcode ? 'barcode' : 'SKU'} already exists`,
        { status: 409 }
      )
    }

    // Create new item
    const item = await prisma.item.create({
      data: {
        barcode,
        sku,
        name,
      }
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error("Error creating item:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
} 