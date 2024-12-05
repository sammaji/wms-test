"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import { BarcodeScanner } from "@/components/barcode-scanner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Stock {
  id: string
  quantity: number
  item: {
    id: string
    sku: string
    name: string
  }
}

export function MoveStockForm() {
  const [step, setStep] = useState<"source" | "destination" | "confirm">("source")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [manualBarcode, setManualBarcode] = useState("")
  const [sourceStock, setSourceStock] = useState<Stock[]>([])
  const [sourceBay, setSourceBay] = useState("")
  const [destinationBay, setDestinationBay] = useState("")

  // Process source bay barcode
  const processSourceBarcode = async (barcode: string) => {
    if (isProcessing) return
    setIsProcessing(true)

    try {
      // First verify the location exists
      const locationResponse = await fetch(`/api/locations/${encodeURIComponent(barcode)}`)
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
            description: "Failed to verify location",
            variant: "destructive",
          })
        }
        return
      }

      // Then fetch all stock in this location
      const stockResponse = await fetch(`/api/stock/location/${encodeURIComponent(barcode)}`)
      if (!stockResponse.ok) throw new Error('Failed to fetch stock')
      
      const items = await stockResponse.json()
      if (items.length === 0) {
        toast({
          title: "Error",
          description: "No stock found in this location",
          variant: "destructive",
        })
        return
      }

      setSourceBay(barcode)
      setSourceStock(items)
      setStep("destination")
      setIsScannerOpen(false)
      setManualBarcode("")

    } catch (error) {
      console.error("Error processing source barcode:", error)
      toast({
        title: "Error",
        description: "Failed to process barcode",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Process destination bay barcode
  const processDestinationBarcode = async (barcode: string) => {
    if (isProcessing) return
    if (barcode === sourceBay) {
      toast({
        title: "Error",
        description: "Destination bay cannot be the same as source bay",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    try {
      const response = await fetch(`/api/locations/${encodeURIComponent(barcode)}`)
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "Error",
            description: "Location not found",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Error",
            description: "Failed to verify location",
            variant: "destructive",
          })
        }
        return
      }

      setDestinationBay(barcode)
      setStep("confirm")
      setIsScannerOpen(false)
      setManualBarcode("")

    } catch (error) {
      console.error("Error processing destination barcode:", error)
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
    if (step === "source") {
      processSourceBarcode(manualBarcode.trim())
    } else if (step === "destination") {
      processDestinationBarcode(manualBarcode.trim())
    }
  }

  // Handle move confirmation
  const handleMoveConfirm = async () => {
    try {
      setIsProcessing(true)
      const response = await fetch("/api/stock/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceBay,
          destinationBay,
          items: sourceStock.map(stock => ({
            stockId: stock.id,
            quantity: stock.quantity
          }))
        })
      })

      if (!response.ok) throw new Error("Failed to move stock")

      toast({
        title: "Success",
        description: "Stock moved successfully",
      })

      // Reset form and redirect
      window.location.href = "/stock/move"
    } catch (error) {
      console.error("Failed to move stock:", error)
      toast({
        title: "Error",
        description: "Failed to move stock",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const renderScanStep = (stepTitle: string, onScan: (barcode: string) => Promise<void>) => (
    <div className="flex flex-col items-center justify-center gap-4">
      <Button
        size="lg"
        className="w-full"
        onClick={() => setIsScannerOpen(true)}
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
        onClick={() => window.location.href = "/stock/move"}
        disabled={isProcessing}
      >
        Cancel
      </Button>

      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={onScan}
      />
    </div>
  )

  if (step === "source") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground mb-4">
          Scan or enter the bay location you are moving stock from
        </p>
        {renderScanStep("Source Location", processSourceBarcode)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Source Bay Information */}
      <div>
        <h2 className="font-medium mb-2">Source Location: {sourceBay}</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sourceStock.map((stock) => (
                <TableRow key={stock.id}>
                  <TableCell>{stock.item.sku}</TableCell>
                  <TableCell>{stock.item.name}</TableCell>
                  <TableCell className="text-right">{stock.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Destination Bay Scanner */}
      {step === "destination" && (
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Scan or enter the bay location you are moving stock to
          </p>
          {renderScanStep("Destination Location", processDestinationBarcode)}
        </div>
      )}

      {/* Confirmation */}
      {step === "confirm" && (
        <div>
          <h2 className="font-medium mb-4">Confirm Move</h2>
          <p className="mb-4">
            Moving all stock from <strong>{sourceBay}</strong> to{" "}
            <strong>{destinationBay}</strong>
          </p>
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => window.location.href = "/stock/move"}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMoveConfirm}
              disabled={isProcessing}
            >
              {isProcessing ? "Moving..." : "Confirm Move"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
} 