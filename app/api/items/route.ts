import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(req: Request) {
  try {
    console.log("Received POST request to /api/items")
    const body = await req.json()
    console.log("Request body:", body)
    const { barcode, sku, name, companyId } = body

    // Validate required fields
    if (!barcode || !name || !companyId) {
      console.log("Validation failed: Missing required fields", { barcode, name, companyId })
      return new NextResponse("Barcode, name, and company are required", { status: 400 })
    }

    // Generate SKU if not provided
    const itemSku = sku || `SKU-${barcode}`
    console.log("Using SKU:", itemSku)

    // Check if barcode already exists for this company
    console.log("Checking for existing barcode in company:", { barcode, companyId })
    const existingBarcode = await prisma.item.findFirst({
      where: { 
        barcode,
        companyId
      }
    })

    if (existingBarcode) {
      console.log("Found existing barcode:", existingBarcode)
      return new NextResponse(
        "Item with this barcode already exists in this company",
        { status: 409 }
      )
    }

    // Check if SKU already exists for this company (if provided)
    if (sku) {
      console.log("Checking for existing SKU in company:", { sku: itemSku, companyId })
      const existingSku = await prisma.item.findFirst({
        where: { 
          sku: itemSku,
          companyId
        }
      })

      if (existingSku) {
        console.log("Found existing SKU:", existingSku)
        return new NextResponse(
          "Item with this SKU already exists in this company",
          { status: 409 }
        )
      }
    }

    // Create new item
    console.log("Creating new item with data:", { barcode, sku: itemSku, name, companyId })
    const item = await prisma.item.create({
      data: {
        barcode,
        sku: itemSku,
        name,
        companyId
      },
      include: {
        company: true
      }
    })
    console.log("Item created successfully:", item)

    // Return formatted response
    return NextResponse.json({
      id: item.id,
      barcode: item.barcode,
      sku: item.sku,
      name: item.name,
      companyId: item.companyId,
      companyCode: item.company.code
    })
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