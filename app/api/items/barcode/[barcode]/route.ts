import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(
  req: Request,
  { params }: { params: { barcode: string } }
) {
  try {
    const item = await prisma.item.findUnique({
      where: {
        barcode: params.barcode
      }
    })

    if (!item) {
      return new NextResponse("Item not found", { status: 404 })
    }

    return NextResponse.json(item)
  } catch (error) {
    console.error("Error fetching item:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
} 