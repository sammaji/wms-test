import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(req: Request) {
  try {
    console.log("Received POST request to /api/items")
    const body = await req.json()
    console.log("Request body:", body)
    const { barcode, sku, name } = body

    // Validate required fields
    if (!barcode || !name) {
      console.log("Validation failed: Missing required fields", { barcode, name })
      return new NextResponse("Barcode and name are required", { status: 400 })
    }

    // Generate SKU if not provided
    const itemSku = sku || `SKU-${barcode}`
    console.log("Using SKU:", itemSku)

    // Check if barcode already exists
    console.log("Checking for existing barcode:", barcode)
    const existingBarcode = await prisma.item.findUnique({
      where: { barcode }
    })

    if (existingBarcode) {
      console.log("Found existing barcode:", existingBarcode)
      return new NextResponse(
        "Item with this barcode already exists",
        { status: 409 }
      )
    }

    // Check if SKU already exists (if provided)
    if (sku) {
      console.log("Checking for existing SKU:", itemSku)
      const existingSku = await prisma.item.findUnique({
        where: { sku: itemSku }
      })

      if (existingSku) {
        console.log("Found existing SKU:", existingSku)
        return new NextResponse(
          "Item with this SKU already exists",
          { status: 409 }
        )
      }
    }

    // Create new item
    console.log("Creating new item with data:", { barcode, sku: itemSku, name })
    const item = await prisma.item.create({
      data: {
        barcode,
        sku: itemSku,
        name,
      }
    })
    console.log("Item created successfully:", item)

    return NextResponse.json(item)
  } catch (error) {
    console.error("Error creating item:", error)
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error"
    console.error("Error message:", errorMessage)
    return new NextResponse(
      errorMessage,
      { status: 500 }
    )
  }
} 