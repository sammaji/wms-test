"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import { BarcodeScanner } from "@/components/barcode-scanner"

const serverLog = async (message: string, data?: any) => {
  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, data })
    })
  } catch (error) {
    // Silently fail if logging fails
  }
}

export function PutawayForm() {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [manualBarcode, setManualBarcode] = useState("")

  const processBarcode = async (barcode: string) => {
    if (isProcessing) return
    setIsProcessing(true)

    try {
      serverLog("Processing barcode in putaway form", { barcode })
      // First verify the location exists
      const locationResponse = await fetch(`/api/locations/${encodeURIComponent(barcode)}`)
      
      if (!locationResponse.ok) {
        if (locationResponse.status === 404) {
          serverLog("Location not found", { barcode })
          toast({
            title: "Error",
            description: "Location not found",
            variant: "destructive",
          })
        } else {
          serverLog("Failed to verify location", { barcode, status: locationResponse.status })
          toast({
            title: "Error",
            description: "Failed to verify location",
            variant: "destructive",
          })
        }
        setIsScanning(false)
        return
      }

      // Show success toast
      toast({
        title: "Bay Location Scanned",
        description: `Successfully scanned bay location: ${barcode}`,
      })

      serverLog("Location verified, navigating", { barcode })
      // Redirect to the putaway page with the bay code
      router.push(`/stock/putaway/${encodeURIComponent(barcode)}`)
    } catch (error) {
      serverLog("Error processing barcode", { error })
      toast({
        title: "Error",
        description: "Failed to process barcode",
        variant: "destructive",
      })
      setIsScanning(false)
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
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Putaway Process</h2>
        <p className="text-sm text-muted-foreground">
          Scan or enter the bay location you are putting stock into
        </p>
      </div>
      
      <div className="flex flex-col items-center justify-center gap-4">
        <Button
          size="lg"
          className="w-full relative"
          onClick={() => {
            serverLog("Scan Now button clicked")
            setIsScanning(true)
            setIsProcessing(false)
          }}
          disabled={isProcessing || isScanning}
        >
          {isProcessing ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Processing...
            </>
          ) : isScanning ? "Scanning..." : "Scan Now"}
        </Button>

        <div className="w-full">
          <BarcodeScanner
            isOpen={true}
            onClose={() => {
              serverLog("Scanner closed")
              setIsScanning(false)
            }}
            onScan={processBarcode}
            isScanning={isScanning}
          />
        </div>

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
              {isProcessing ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing...
                </>
              ) : "Submit"}
            </Button>
          </form>
        </div>

        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => router.push('/stock')}
          disabled={isProcessing}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
} 