"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BarcodeScanner } from "@/components/barcode-scanner"
import { toast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"

interface Location {
  id: string
  label: string
}

export function RemoveStockForm() {
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [manualBarcode, setManualBarcode] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const router = useRouter()

  const processBarcode = async (barcode: string) => {
    if (isProcessing) return
    setIsProcessing(true)

    try {
      console.log("=== START BARCODE PROCESSING ===")
      console.log("Barcode received:", barcode)

      // First verify the location exists
      const locationUrl = `/api/locations/${encodeURIComponent(barcode)}`
      console.log("Location URL:", locationUrl)
      
      console.log("Making location request...")
      const locationResponse = await fetch(locationUrl).catch(e => {
        console.error("Fetch error:", e)
        throw e
      })
      console.log("Location response received")
      console.log("Status:", locationResponse.status)
      console.log("Status text:", locationResponse.statusText)
      
      const locationText = await locationResponse.text().catch(e => {
        console.error("Text read error:", e)
        throw e
      })
      console.log("Response text:", locationText)
      
      if (!locationResponse.ok) {
        if (locationResponse.status === 404) {
          toast({
            title: "Error",
            description: "Location not found",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Error",
            description: locationText || "Failed to verify location",
            variant: "destructive",
          })
        }
        return
      }

      // Parse the location response
      let location: Location
      try {
        console.log("Attempting to parse location response...")
        location = JSON.parse(locationText)
        console.log("Successfully parsed location:", location)
      } catch (e) {
        console.error("JSON Parse Error:", e)
        console.error("Failed text:", locationText)
        toast({
          title: "Error",
          description: "Invalid location response format",
          variant: "destructive",
        })
        return
      }

      // Then fetch all stock in this location
      console.log("Fetching stock...")
      const stockUrl = `/api/stock/location/${encodeURIComponent(location.label)}`
      console.log("Stock URL:", stockUrl)
      
      console.log("Making stock request...")
      const stockResponse = await fetch(stockUrl).catch(e => {
        console.error("Stock fetch error:", e)
        throw e
      })
      console.log("Stock response received")
      console.log("Status:", stockResponse.status)
      console.log("Status text:", stockResponse.statusText)
      
      if (!stockResponse.ok) {
        const stockError = await stockResponse.text()
        console.error("Stock fetch failed")
        console.error("Status:", stockResponse.status)
        console.error("Error text:", stockError)
        throw new Error('Failed to fetch stock')
      }
      
      const items = await stockResponse.json().catch(e => {
        console.error("Stock parse error:", e)
        throw e
      })
      console.log("Stock items parsed:", items)
      
      if (items.length === 0) {
        console.log("No stock found in location")
        toast({
          title: "Error",
          description: "No stock found in this location",
          variant: "destructive",
        })
        return
      }

      // Navigate to the selection page with the bay code
      const redirectUrl = `/stock/remove/${encodeURIComponent(location.label)}`
      console.log("Redirecting to:", redirectUrl)
      router.push(redirectUrl)

    } catch (error: unknown) {
      console.error("=== ERROR IN BARCODE PROCESSING ===")
      if (error instanceof Error) {
        console.error("Error type: Error")
        console.error("Error message:", error.message)
        console.error("Stack trace:", error.stack)
      } else {
        console.error("Error type: Unknown")
        console.error("Error value:", error)
      }
      console.error("=== END ERROR ===")
      
      toast({
        title: "Error",
        description: "Failed to process barcode",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualBarcode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a barcode",
        variant: "destructive",
      })
      return
    }
    processBarcode(manualBarcode.trim())
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center gap-4">
        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            console.log("Opening scanner...")
            setIsScannerOpen(true)
          }}
          disabled={isProcessing}
        >
          {isProcessing ? "Processing..." : "Scan Now"}
        </Button>

        <div className="w-full p-4 border rounded-lg">
          <h3 className="text-sm font-medium mb-2">Or enter barcode manually:</h3>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <Input
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              placeholder="Enter barcode..."
              className="flex-1"
              disabled={isProcessing}
            />
            <Button type="submit" disabled={isProcessing}>
              {isProcessing ? "Processing..." : "Submit"}
            </Button>
          </form>
        </div>

        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => window.history.back()}
          disabled={isProcessing}
        >
          Cancel
        </Button>
      </div>

      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => {
          console.log("Closing scanner...")
          setIsScannerOpen(false)
        }}
        onScan={processBarcode}
      />
    </div>
  )
} 