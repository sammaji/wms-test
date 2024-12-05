import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  try {
    // Get the location code from the URL
    const url = new URL(request.url)
    const locationCode = url.pathname.split('/').pop()
    
    console.log("GET /api/locations - Looking up location:", locationCode)

    if (!locationCode) {
      console.log("No location code provided")
      return new NextResponse("Location code is required", { status: 400 })
    }

    // Parse the location code (expected format: {aisle}-{bay}-{height})
    const parts = locationCode.split('-')
    console.log("Location code parts:", parts)

    // Find the location
    const location = await prisma.location.findFirst({
      where: { 
        label: {
          equals: locationCode,
          mode: 'insensitive' // Case-insensitive match
        }
      }
    })

    console.log("Location lookup result:", location)

    if (!location) {
      // Try to find by individual parts if exact match fails
      if (parts.length === 3) {
        const [aisle, bay, height] = parts
        const alternativeLocation = await prisma.location.findFirst({
          where: {
            aisle: { equals: aisle, mode: 'insensitive' },
            bay: { equals: bay, mode: 'insensitive' },
            height: { equals: height, mode: 'insensitive' }
          }
        })
        console.log("Alternative location lookup result:", alternativeLocation)
        
        if (alternativeLocation) {
          return NextResponse.json(alternativeLocation)
        }
      }
      return new NextResponse("Location not found", { status: 404 })
    }

    return NextResponse.json(location)
  } catch (error) {
    console.error("Error looking up location:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log("POST /api/locations - Creating location:", body)

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