import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log("Received location creation request:", body)

    const { aisle, bay, height, label, type } = body

    // Validate required fields
    if (!aisle || !bay || !height || !label || !type) {
      console.log("Missing required fields:", { aisle, bay, height, label, type })
      return new NextResponse("Missing required fields", { status: 400 })
    }

    // Check if location with label already exists
    const existing = await prisma.location.findUnique({
      where: { label }
    })

    if (existing) {
      console.log("Location already exists:", existing)
      return new NextResponse("Location with this label already exists", { status: 409 })
    }

    // Create new location
    const location = await prisma.location.create({
      data: {
        aisle,
        bay,
        height,
        label,
        type
      }
    })

    console.log("Created new location:", location)
    return NextResponse.json(location)
  } catch (error) {
    console.error("Error creating location:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
} 