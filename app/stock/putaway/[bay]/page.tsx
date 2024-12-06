"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { BarcodeScanner } from "@/components/barcode-scanner"
import { AddSKUDialog } from "@/components/add-sku-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, Minus, Plus, Trash2 } from "lucide-react"

interface ScannedItem {
  id: string
  sku: string
  name: string
  barcode: string
  quantity: number
}

export default function PutawayDetailPage({
  params
}: {
  params: { bay: string }
}) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([])
  const [currentItem, setCurrentItem] = useState<ScannedItem | null>(null)
  const [isAddSKUOpen, setIsAddSKUOpen] = useState(false)
  const [companies, setCompanies] = useState<{ id: string; code: string }[]>([])
  const [lastScannedBarcode, setLastScannedBarcode] = useState("")

  // Fetch companies on mount
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch('/api/companies')
        if (!response.ok) throw new Error('Failed to fetch companies')
        const data = await response.json()
        setCompanies(data)
      } catch (error) {
        console.error('Failed to fetch companies:', error)
        toast({
          title: "Error",
          description: "Failed to load companies",
          variant: "destructive",
        })
      }
    }
    fetchCompanies()
  }, [])

  // Process scanned item
  const processBarcode = async (barcode: string) => {
    if (isProcessing) return
    setIsProcessing(true)
    setLastScannedBarcode(barcode)

    try {
      const response = await fetch(`/api/items/barcode/${barcode}`)
      
      if (response.status === 404) {
        // Item not found, show add SKU dialog
        setIsAddSKUOpen(true)
        setIsScanning(false)
        return
      }

      const data = await response.json()
      
      const scannedItem = {
        id: data.id,
        sku: data.sku,
        name: data.name,
        barcode: data.barcode,
        quantity: 1
      }
      
      setCurrentItem(scannedItem)
      
      toast({
        title: "Item Found",
        description: `Found item: ${data.name}. Please confirm this is correct.`,
        variant: "success"
      })

      // Only set isScanning to false after successful processing
      setIsScanning(false)
    } catch (error) {
      console.error("Error checking item:", error)
      toast({
        title: "Error",
        description: "Failed to process item",
        variant: "destructive",
      })
      setIsScanning(false)
    } finally {
      setIsProcessing(false)
    }
  }

  // Update item quantity
  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    setScannedItems(items =>
      items.map(item =>
        item.id === itemId
          ? { ...item, quantity: Math.max(1, newQuantity) }
          : item
      )
    )
  }

  // Remove item from list
  const removeItem = (itemId: string) => {
    setScannedItems(items => items.filter(item => item.id !== itemId))
  }

  // Handle item confirmation
  const handleItemConfirmation = (confirmed: boolean) => {
    if (confirmed && currentItem) {
      setScannedItems(prev => [...prev, currentItem])
      setCurrentItem(null)
      toast({
        title: "Item Added",
        description: "Ready to scan next item",
        variant: "success"
      })
    } else {
      setCurrentItem(null)
      toast({
        title: "Item Cancelled",
        description: "Ready to scan next item",
      })
    }
  }

  // Handle new SKU creation success
  const handleNewSKUSuccess = (newItem: any) => {
    const scannedItem = {
      id: newItem.id,
      sku: newItem.sku,
      name: newItem.name,
      barcode: newItem.barcode,
      quantity: 1
    }
    setCurrentItem(scannedItem)
    setIsAddSKUOpen(false)
    toast({
      title: "Success",
      description: "Item created successfully",
      variant: "success"
    })
  }

  // Handle final putaway
  const handleFinalPutaway = async () => {
    setIsProcessing(true)
    try {
      const response = await fetch("/api/stock/putaway-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locationLabel: params.bay,
          items: scannedItems.map(item => ({
            itemId: item.id,
            quantity: item.quantity,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      toast({
        title: "Success",
        description: `All items have been added to ${params.bay}`,
        variant: "success"
      })

      // Redirect back to putaway page
      router.push('/stock/putaway')
    } catch (error) {
      console.error("Error adding stock:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add stock",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="container max-w-xl py-6">
      <div className="space-y-2 mb-6">
        <h1 className="text-2xl font-bold">Putaway to {params.bay}</h1>
        <p className="text-sm text-muted-foreground">
          Scan items to put into bay location {params.bay}
        </p>
      </div>
      
      <div className="space-y-6">
        {/* Current Item Confirmation */}
        {currentItem && (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Item Name:</span>
                <span className="font-medium">{currentItem.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SKU:</span>
                <span className="font-medium">{currentItem.sku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Barcode:</span>
                <span className="font-medium">{currentItem.barcode}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => handleItemConfirmation(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleItemConfirmation(true)}
              >
                Confirm Item
              </Button>
            </div>
          </div>
        )}

        {/* Scanned Items List */}
        {scannedItems.length > 0 && !currentItem && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Items to putaway:</h2>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scannedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-12 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Scanner Section */}
        {!currentItem && (
          <div className="space-y-4">
            <Button
              size="lg"
              className="w-full relative"
              onClick={() => setIsScanning(true)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing...
                </>
              ) : isScanning ? "Scanning..." : "Scan Item"}
            </Button>

            <div className="w-full">
              <BarcodeScanner
                isOpen={!currentItem}
                onClose={() => setIsScanning(false)}
                onScan={processBarcode}
                isScanning={isScanning}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/stock/putaway')}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          {scannedItems.length > 0 && !currentItem && (
            <Button
              onClick={handleFinalPutaway}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing...
                </>
              ) : (
                "Complete Putaway"
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Add SKU Dialog */}
      <AddSKUDialog
        open={isAddSKUOpen}
        onOpenChange={setIsAddSKUOpen}
        onSuccess={handleNewSKUSuccess}
        companies={companies}
        defaultBarcode={lastScannedBarcode}
      />
    </div>
  )
} 