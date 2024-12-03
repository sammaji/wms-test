"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BarcodeScanner } from "@/components/barcode-scanner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"

export default function ScanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const action = searchParams.get("action") // 'add', 'remove', or 'move'

  const [isScanning, setIsScanning] = useState(true)
  const [barcode, setBarcode] = useState("")
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false)
  const [isNewItemDialogOpen, setIsNewItemDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [newItem, setNewItem] = useState({
    barcode: "",
    sku: "",
    name: "",
  })

  // Handle barcode input from any source
  const handleBarcodeInput = async (code: string) => {
    setBarcode(code)
    await checkAndProcessBarcode(code)
  }

  // Check if item exists and process accordingly
  const checkAndProcessBarcode = async (barcode: string) => {
    try {
      const response = await fetch(`/api/items/barcode/${barcode}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          // Item not found, show dialog to add new item
          setNewItem(prev => ({ ...prev, barcode }))
          setIsNewItemDialogOpen(true)
          setIsScanning(false)
        } else {
          throw new Error("Failed to check item")
        }
        return
      }

      const item = await response.json()
      
      // Item found, redirect to appropriate action page
      if (action) {
        router.push(`/stock/${action}?itemId=${item.id}`)
      } else {
        router.push(`/items/${item.id}`)
      }
    } catch (error) {
      console.error("Error checking item:", error)
      toast({
        title: "Error",
        description: "Failed to check item. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Handle scanner errors
  const handleError = (error: Error) => {
    console.error("Scanner error:", error)
    toast({
      title: "Scanner Error",
      description: "Failed to access camera. Please check permissions.",
      variant: "destructive",
    })
  }

  // Handle manual form submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (barcode) {
      handleBarcodeInput(barcode)
      setIsManualDialogOpen(false)
    }
  }

  // Handle new item submission
  const handleAddNewItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newItem),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }

      const item = await response.json()
      setIsNewItemDialogOpen(false)
      
      toast({
        title: "Success",
        description: "Item added successfully.",
      })

      // Redirect to appropriate action page
      if (action) {
        router.push(`/stock/${action}?itemId=${item.id}`)
      } else {
        router.push(`/items/${item.id}`)
      }
    } catch (error) {
      console.error("Error adding item:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add item. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Global keyboard handler for barcode scanner gun
  useEffect(() => {
    let buffer = ""
    let timeout: NodeJS.Timeout

    const handleKeyPress = (e: KeyboardEvent) => {
      // Clear timeout on each keypress
      if (timeout) {
        clearTimeout(timeout)
      }

      // If it's Enter/Return, process the barcode
      if (e.key === 'Enter') {
        if (buffer.length > 0) {
          handleBarcodeInput(buffer)
          buffer = "" // Clear buffer after processing
        }
        return
      }

      // Add character to buffer
      buffer += e.key

      // Set timeout to clear buffer if no new keypress within 50ms
      // (barcode scanners typically send characters very quickly)
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
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-center">Scan Item</h1>
      <p className="text-center text-muted-foreground">
        {action ? `Scan an item to ${action} stock` : "Scan an item to view details"}
      </p>

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
              <DialogTitle>Enter Barcode Manually</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode</Label>
                <Input
                  id="barcode"
                  ref={inputRef}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Enter barcode..."
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
            onError={handleError}
          />
        </div>
      </div>

      <Dialog open={isNewItemDialogOpen} onOpenChange={setIsNewItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
            <DialogDescription>
              This item is not in the system. Please enter the details below.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddNewItem} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                value={newItem.barcode}
                readOnly
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={newItem.sku}
                onChange={(e) => setNewItem(prev => ({ ...prev, sku: e.target.value }))}
                placeholder="Enter SKU"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Item Name</Label>
              <Input
                id="name"
                value={newItem.name}
                onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter item name"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewItemDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
} 