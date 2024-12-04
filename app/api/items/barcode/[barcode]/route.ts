import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(
  req: Request,
  { params }: { params: { barcode: string } }
) {
  try {
    console.log("[BARCODE_LOOKUP] Looking up barcode:", params.barcode)
    
    // First, try to find all items with this barcode
    const items = await prisma.item.findMany({
      where: {
        barcode: params.barcode
      },
      include: {
        company: true
      }
    })

    console.log("[BARCODE_LOOKUP] Found items:", items)

    if (items.length === 0) {
      console.log("[BARCODE_LOOKUP] No items found")
      return new NextResponse("Item not found", { status: 404 })
    }

    if (items.length === 1) {
      // If only one item exists with this barcode, return it directly
      const item = items[0]
      console.log("[BARCODE_LOOKUP] Single item found:", item)
      return NextResponse.json({
        id: item.id,
        sku: item.sku,
        name: item.name,
        barcode: item.barcode,
        description: item.description,
        companyId: item.companyId,
        companyCode: item.company.code
      })
    }

    // If multiple items exist with this barcode (one per company), return a special response
    console.log("[BARCODE_LOOKUP] Multiple items found:", items)
    return NextResponse.json({
      multipleCompanies: true,
      items: items.map(item => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        barcode: item.barcode,
        companyId: item.companyId,
        companyCode: item.company.code
      }))
    }, { status: 300 }) // Using 300 Multiple Choices status code
  } catch (error) {
    console.error("[BARCODE_LOOKUP] Error:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
} 