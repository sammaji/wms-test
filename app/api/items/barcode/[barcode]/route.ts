import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"

// Use Prisma's inferred types
type ItemWithCompany = Prisma.ItemGetPayload<{
  include: { company: true }
}>

export async function GET(
  req: Request,
  { params }: { params: { barcode: string } }
) {
  try {
    console.log("[BARCODE_LOOKUP] Looking up barcode:", params.barcode)
    
    const items = await prisma.item.findMany({
      where: {
        barcode: params.barcode
      },
      include: {
        company: {
          select: {
            id: true,
            code: true
          }
        }
      }
    })

    console.log("[BARCODE_LOOKUP] Found items:", items)

    if (items.length === 0) {
      console.log("[BARCODE_LOOKUP] No items found")
      return new NextResponse("Item not found", { status: 404 })
    }

    if (items.length === 1) {
      const item = items[0]
      console.log("[BARCODE_LOOKUP] Single item found:", item)
      return NextResponse.json({
        id: item.id,
        sku: item.sku,
        name: item.name,
        barcode: item.barcode,
        description: item.description,
        companyId: item.company.id,
        companyCode: item.company.code
      })
    }

    console.log("[BARCODE_LOOKUP] Multiple items found:", items)
    return NextResponse.json({
      multipleCompanies: true,
      items: items.map(item => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        barcode: item.barcode,
        companyId: item.company.id,
        companyCode: item.company.code
      }))
    }, { status: 300 })
  } catch (error) {
    console.error("[BARCODE_LOOKUP] Error:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
} 