"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { BarcodeScanner } from "@/components/barcode-scanner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"

type PutawayState = "scanning_bay" | "confirming_bay" | "scanning_items" | "confirming_item" | "entering_quantity" | "confirming_putaway"

interface ScannedItem {
  id: string
  sku: string
  name: string
  barcode: string
}

interface NewLocation {
  aisle: string
  bay: string
  height: string
  type: string
}

export default function PutawayPage() {
  const router = useRouter()
  const [state, setState] = useState<PutawayState>("scanning_bay")
  const [isScanning, setIsScanning] = useState(true)
  const [bayLabel, setBayLabel] = useState("")
  const [currentItem, setCurrentItem] = useState<ScannedItem | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false)
  const [manualInput, setManualInput] = useState("")
  const [isNewLocationDialogOpen, setIsNewLocationDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newLocation, setNewLocation] = useState<NewLocation>({
    aisle: "",
    bay: "",
    height: "",
    type: "BAY"
  })
  const [pendingLabel, setPendingLabel] = useState("")

  // Handle bay confirmation
  const handleBayConfirmation = (confirmed: boolean) => {
    if (confirmed) {
      setState("scanning_items")
      setIsScanning(true)
      toast({
        title: "Bay Confirmed",
        description: `Now scanning items for bay ${bayLabel}`,
      })
    } else {
      setState("scanning_bay")
      setBayLabel("")
      setIsScanning(true)
      toast({
        title: "Bay Cancelled",
        description: "Please scan a different bay location",
      })
    }
  }

  // Handle item confirmation
  const handleItemConfirmation = (confirmed: boolean) => {
    if (confirmed) {
      setState("entering_quantity")
      setIsScanning(false)
      toast({
        title: "Item Confirmed",
        description: "Please enter the quantity to putaway",
      })
    } else {
      setState("scanning_items")
      setCurrentItem(null)
      setQuantity(1)
      setIsScanning(true)
      toast({
        title: "Item Cancelled",
        description: "Please scan a different item",
      })
    }
  }

  // Remove the automatic scanning effect
  useEffect(() => {
    if (state !== "scanning_bay" && state !== "scanning_items") {
      setIsScanning(false)
    }
  }, [state])

  // Handle any barcode input (from camera or keyboard)
  const handleBarcodeInput = async (code: string) => {
    console.log("Barcode input received:", code)
    console.log("Current state:", state)
    
    if (state === "scanning_bay") {
      console.log("Handling bay scan...")
      await handleBayScan(code)
    } else if (state === "scanning_items") {
      console.log("Handling item scan...")
      await handleItemScan(code)
    } else {
      console.log("Invalid state for scanning:", state)
    }
  }

  // Handle bay barcode scan
  const handleBayScan = async (code: string) => {
    console.log("Handling bay scan:", code)
    try {
      const response = await fetch(`/api/locations/label/${code}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          // Location not found, show dialog to add new location
          setPendingLabel(code)
          setIsNewLocationDialogOpen(true)
          setIsScanning(false)
        } else {
          throw new Error("Failed to check bay location")
        }
        return
      }

      // Bay found, move to confirmation
      setBayLabel(code)
      setState("confirming_bay")
      setIsScanning(false)
      toast({
        title: "Bay Found",
        description: `Please confirm bay location: ${code}`,
      })
    } catch (error) {
      console.error("Error checking bay:", error)
      toast({
        title: "Error",
        description: "Failed to verify bay location. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Handle item barcode scan
  const handleItemScan = async (code: string) => {
    console.log("Handling item scan:", code)
    try {
      const response = await fetch(`/api/items/barcode/${code}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          // Item not found, redirect to scan page to add new item
          router.push(`/scan?action=putaway&bay=${bayLabel}`)
        } else {
          throw new Error("Failed to check item")
        }
        return
      }

      const item = await response.json()
      setCurrentItem(item)
      setState("confirming_item")
      setIsScanning(false)
      toast({
        title: "Item Found",
        description: `Found item: ${item.name}. Please confirm this is correct.`,
      })
    } catch (error) {
      console.error("Error checking item:", error)
      toast({
        title: "Error",
        description: "Failed to check item. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Handle putaway submission
  const handlePutaway = async () => {
    if (!currentItem || !bayLabel) return

    try {
      const response = await fetch("/api/stock/putaway", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemId: currentItem.id,
          locationLabel: bayLabel,
          quantity,
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      toast({
        title: "Success",
        description: `Added ${quantity} x ${currentItem.name} to ${bayLabel}`,
      })

      // Reset for next item
      setCurrentItem(null)
      setQuantity(1)
      setState("scanning_items")
      setIsScanning(true)
    } catch (error) {
      console.error("Error adding stock:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add stock. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Handle quantity confirmation
  const handleQuantityConfirmation = () => {
    setState("confirming_putaway")
    toast({
      title: "Confirm Putaway",
      description: `Please confirm: ${quantity} x ${currentItem?.name} to ${bayLabel}`,
    })
  }

  // Handle manual input submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualInput) {
      handleBarcodeInput(manualInput)
      setManualInput("")
      setIsManualDialogOpen(false)
    }
  }

  // Handle new location submission
  const handleAddNewLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newLocation,
          label: pendingLabel
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }

      const location = await response.json()
      setIsNewLocationDialogOpen(false)
      
      toast({
        title: "Success",
        description: "Location added successfully.",
      })

      // Set the bay and move to item scanning
      setBayLabel(pendingLabel)
      setState("scanning_items")
      setIsScanning(true)
    } catch (error) {
      console.error("Error adding location:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add location. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update the keyboard handler to consider the current state
  useEffect(() => {
    let buffer = ""
    let timeout: NodeJS.Timeout

    const handleKeyPress = (e: KeyboardEvent) => {
      // Only process keyboard input if we're in scanning mode
      if (!isScanning) return

      // Clear timeout on each keypress
      if (timeout) {
        clearTimeout(timeout)
      }

      // If it's Enter/Return, process the barcode
      if (e.key === 'Enter') {
        if (buffer.length > 0) {
          console.log("Processing barcode from keyboard:", buffer) // Debug log
          handleBarcodeInput(buffer)
          buffer = "" // Clear buffer after processing
        }
        return
      }

      // Add character to buffer
      buffer += e.key
      console.log("Current buffer:", buffer) // Debug log

      // Set timeout to clear buffer if no new keypress within 50ms
      timeout = setTimeout(() => {
        buffer = ""
      }, 50)
    }

    // Add global event listener
    window.addEventListener('keypress', handleKeyPress)

    return () => {
      window.removeEventListener('keypress', handleKeyPress)
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }, [isScanning, handleBarcodeInput, state]) // Add all required dependencies

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground text-center">
        Debug - Scanning: {isScanning ? "Yes" : "No"}, State: {state}
      </div>
      
      <h1 className="text-2xl font-bold text-center">
        {state === "scanning_bay" 
          ? "Scan Bay Location"
          : state === "confirming_bay"
          ? "Confirm Bay Location"
          : state === "scanning_items"
          ? `Scanning Items for ${bayLabel}`
          : state === "confirming_item"
          ? "Confirm Item"
          : state === "entering_quantity"
          ? `Enter Quantity for ${currentItem?.name}`
          : "Confirm Putaway"}
      </h1>

      {state === "confirming_bay" ? (
        <div className="max-w-md mx-auto space-y-4">
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bay Label:</span>
              <span className="font-medium">{bayLabel}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleBayConfirmation(false)}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1"
              onClick={() => handleBayConfirmation(true)}
            >
              Confirm Bay
            </Button>
          </div>
        </div>
      ) : state === "confirming_item" ? (
        <div className="max-w-md mx-auto space-y-4">
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Item:</span>
              <span className="font-medium">{currentItem?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SKU:</span>
              <span className="font-medium">{currentItem?.sku}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bay:</span>
              <span className="font-medium">{bayLabel}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleItemConfirmation(false)}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1"
              onClick={() => handleItemConfirmation(true)}
            >
              Confirm Item
            </Button>
          </div>
        </div>
      ) : state === "entering_quantity" ? (
        <div className="max-w-md mx-auto space-y-4">
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Item:</span>
              <span className="font-medium">{currentItem?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SKU:</span>
              <span className="font-medium">{currentItem?.sku}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bay:</span>
              <span className="font-medium">{bayLabel}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setState("scanning_items")
                setIsScanning(true)
                setCurrentItem(null)
                setQuantity(1)
              }}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1"
              onClick={handleQuantityConfirmation}
            >
              Next
            </Button>
          </div>
        </div>
      ) : state === "confirming_putaway" ? (
        <div className="max-w-md mx-auto space-y-4">
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Item:</span>
              <span className="font-medium">{currentItem?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SKU:</span>
              <span className="font-medium">{currentItem?.sku}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bay:</span>
              <span className="font-medium">{bayLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quantity:</span>
              <span className="font-medium">{quantity}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setState("entering_quantity")}
            >
              Back
            </Button>
            <Button 
              className="flex-1"
              onClick={handlePutaway}
            >
              Confirm Putaway
            </Button>
          </div>
        </div>
      ) : (
        <>
          {(state === "scanning_bay" || state === "scanning_items") && (
            <>
              <div className="flex justify-center gap-2 mb-4">
                <Button 
                  variant={isScanning ? "secondary" : "default"}
                  onClick={() => setIsScanning(!isScanning)}
                >
                  {isScanning ? "Stop Scanning" : "Start Scanning"}
                </Button>

                <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">Enter Manually</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {state === "scanning_bay" ? "Enter Bay Location" : "Enter Item Barcode"}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleManualSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="manual-input">
                          {state === "scanning_bay" ? "Bay Label" : "Barcode"}
                        </Label>
                        <Input
                          id="manual-input"
                          value={manualInput}
                          onChange={(e) => setManualInput(e.target.value)}
                          placeholder={state === "scanning_bay" ? "Enter bay label..." : "Enter barcode..."}
                          autoComplete="off"
                        />
                      </div>
                      <DialogFooter>
                        <Button type="submit">Submit</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="w-full max-w-md mx-auto bg-black">
                <div className="relative aspect-[3/4]">
                  <BarcodeScanner
                    isScanning={isScanning}
                    onScan={handleBarcodeInput}
                    onError={(error) => {
                      console.error("Scanner error:", error)
                      toast({
                        title: "Scanner Error",
                        description: "Failed to access camera. Please check permissions.",
                        variant: "destructive",
                      })
                      setIsScanning(false)
                    }}
                    readers={state === "scanning_bay" ? ["code_128_reader"] : undefined}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}

      <Dialog open={isNewLocationDialogOpen} onOpenChange={setIsNewLocationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Location</DialogTitle>
            <DialogDescription>
              This location is not in the system. Please enter the details below.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddNewLocation} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={pendingLabel}
                readOnly
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aisle">Aisle</Label>
              <Input
                id="aisle"
                value={newLocation.aisle}
                onChange={(e) => setNewLocation(prev => ({ ...prev, aisle: e.target.value }))}
                placeholder="Enter aisle"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bay">Bay</Label>
              <Input
                id="bay"
                value={newLocation.bay}
                onChange={(e) => setNewLocation(prev => ({ ...prev, bay: e.target.value }))}
                placeholder="Enter bay"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">Height</Label>
              <Input
                id="height"
                value={newLocation.height}
                onChange={(e) => setNewLocation(prev => ({ ...prev, height: e.target.value }))}
                placeholder="Enter height"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsNewLocationDialogOpen(false)
                  setIsScanning(true)
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Location
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
} 