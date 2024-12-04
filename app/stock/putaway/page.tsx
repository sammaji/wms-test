"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Loader2, Minus, Plus, Trash2 } from "lucide-react"
import { CameraScanner } from "@/components/camera-scanner"

type PutawayState = 
  | "ready_to_scan_bay"    // Initial state, waiting for user to click scan
  | "scanning_bay"         // Actively scanning bay
  | "confirming_bay"       // Confirming scanned bay
  | "ready_to_scan_items"  // Bay confirmed, waiting for user to click scan
  | "scanning_items"       // Actively scanning items
  | "confirming_item"      // Confirming scanned item and quantity
  | "reviewing_items"      // Reviewing all scanned items before final commit
  | "confirming_putaway"   // Final confirmation of all items
  | "success"             // Success state showing confirmation

interface ScannedItem {
  id: string
  sku: string
  name: string
  barcode: string
  quantity: number
}

interface NewLocation {
  aisle: string
  bay: string
  height: string
  type: string
}

interface NewItem {
  barcode: string
  sku: string
  name: string
}

export default function PutawayPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const itemId = searchParams.get("itemId")
  const bayFromUrl = searchParams.get("bay")
  const itemsFromUrl = searchParams.get("items")
  const isNewItem = searchParams.get("newItem") === "true"

  console.log("[PUTAWAY] Page mounted with params:", {
    itemId,
    bayFromUrl,
    itemsFromUrl,
    isNewItem
  })

  // State declarations
  const [state, setState] = useState<PutawayState>(() => {
    // If we have a bay from URL, start with scanning items
    if (bayFromUrl) {
      console.log("[PUTAWAY] Starting with ready_to_scan_items due to bay in URL:", bayFromUrl)
      return "ready_to_scan_items"
    }
    // Otherwise start with scanning bay
    console.log("[PUTAWAY] Starting with ready_to_scan_bay (no bay in URL)")
    return "ready_to_scan_bay"
  })
  const [currentItem, setCurrentItem] = useState<ScannedItem | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [bayLabel, setBayLabel] = useState(bayFromUrl || "")
  const [quantity, setQuantity] = useState(1)
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false)
  const [manualInput, setManualInput] = useState("")
  const [isNewLocationDialogOpen, setIsNewLocationDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingLabel, setPendingLabel] = useState("")
  const [newLocation, setNewLocation] = useState<NewLocation>({
    aisle: "",
    bay: "",
    height: "",
    type: "BAY"
  })
  const [isNewItemDialogOpen, setIsNewItemDialogOpen] = useState(false)
  const [newItem, setNewItem] = useState<NewItem>({ barcode: "", sku: "", name: "" })
  
  // Initialize scanned items
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>(() => {
    if (itemsFromUrl) {
      try {
        console.log("[PUTAWAY] Parsing initial items from URL:", itemsFromUrl)
        const items = JSON.parse(decodeURIComponent(itemsFromUrl))
        console.log("[PUTAWAY] Initial items parsed:", items)
        return items
      } catch (e) {
        console.log("[PUTAWAY] Error parsing initial items:", e)
        return []
      }
    }
    console.log("[PUTAWAY] No initial items")
    return []
  })

  // Fetch item effect
  useEffect(() => {
    const fetchItemIfNeeded = async () => {
      if (!itemId) {
        console.log("[PUTAWAY] No itemId to fetch")
        return
      }

      console.log("[PUTAWAY] Fetching item with ID:", itemId)
      try {
        const response = await fetch(`/api/items/${itemId}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch item: ${await response.text()}`)
        }

        const item = await response.json()
        console.log("[PUTAWAY] Successfully fetched item:", item)

        const scannedItem = {
          id: item.id,
          sku: item.sku,
          name: item.name,
          barcode: item.barcode,
          quantity: 1
        }

        console.log("[PUTAWAY] Setting current item:", scannedItem)
        setCurrentItem(scannedItem)
        setState("confirming_item")
        setIsScanning(false)
      } catch (error) {
        console.log("[PUTAWAY] Error fetching item:", error)
        toast({
          title: "Error",
          description: "Failed to fetch item details. Returning to scan.",
          variant: "destructive",
        })
        setState("ready_to_scan_items")
      }
    }

    fetchItemIfNeeded()
  }, [itemId])

  // Handle item confirmation
  const handleItemConfirmation = (confirmed: boolean) => {
    console.log("[PUTAWAY] Item confirmation:", { confirmed, currentItem, existingItems: scannedItems })
    
    if (confirmed && currentItem) {
      // Add item to scanned items list
      const itemToAdd = { ...currentItem, quantity }
      console.log("[PUTAWAY] Adding item to list:", itemToAdd)
      
      setScannedItems(prev => {
        const updated = [...prev, itemToAdd]
        console.log("[PUTAWAY] Updated scanned items:", updated)
        return updated
      })
      
      setCurrentItem(null)
      setQuantity(1)
      setState("ready_to_scan_items")
      setIsScanning(false)
      
      toast({
        title: "Item Added",
        description: "Ready to scan next item",
      })
    } else {
      console.log("[PUTAWAY] Item confirmation cancelled")
      setCurrentItem(null)
      setQuantity(1)
      setState("ready_to_scan_items")
      setIsScanning(false)
      
      toast({
        title: "Item Cancelled",
        description: "Ready to scan next item",
      })
    }
  }

  // Handle new item addition
  useEffect(() => {
    const addNewItemIfNeeded = async () => {
      if (itemId && isNewItem) {
        console.log("[PUTAWAY] Adding new item with ID:", itemId)
        try {
          const response = await fetch(`/api/items/${itemId}`)
          const item = await response.json()
          console.log("[PUTAWAY] Fetched new item:", item)

          const newItem = {
            id: item.id,
            sku: item.sku,
            name: item.name,
            barcode: item.barcode,
            quantity: 1
          }

          setScannedItems(prev => {
            const updated = [...prev, newItem]
            console.log("[PUTAWAY] Updated scanned items:", updated)
            return updated
          })

          toast({
            title: "Item Added",
            description: `${item.name} has been added to the list`,
          })
        } catch (error) {
          console.log("[PUTAWAY] Error adding new item:", error)
          toast({
            title: "Error",
            description: "Failed to add new item",
            variant: "destructive",
          })
        }
      }
    }

    addNewItemIfNeeded()
  }, [itemId, isNewItem])

  // Add debug logging for state changes
  useEffect(() => {
    console.log("[PUTAWAY] State changed to:", state)
    console.log("[PUTAWAY] Current item is:", currentItem)
    console.log("[PUTAWAY] Scanned items are:", scannedItems)
  }, [state, currentItem, scannedItems])

  // Start scanning
  const startScanning = () => {
    setIsScanning(true)
    if (state === "ready_to_scan_bay") {
      setState("scanning_bay")
    } else if (state === "ready_to_scan_items") {
      setState("scanning_items")
    }
  }

  // Stop scanning
  const stopScanning = () => {
    setIsScanning(false)
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

  // Handle bay confirmation
  const handleBayConfirmation = (confirmed: boolean) => {
    if (confirmed) {
      setState("ready_to_scan_items")
      setIsScanning(false) // Don't start scanning automatically
      toast({
        title: "Bay Confirmed",
        description: `Ready to scan items for bay ${bayLabel}`,
      })
    } else {
      setBayLabel("")
      setState("ready_to_scan_bay")
      setIsScanning(false)
      toast({
        title: "Bay Cancelled",
        description: "Please scan a different bay location",
      })
    }
  }

  // Handle final putaway confirmation
  const handleFinalPutaway = async () => {
    setIsSubmitting(true)
    try {
      // Create putaway transactions for all items
      const response = await fetch("/api/stock/putaway-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locationLabel: bayLabel,
          items: scannedItems.map(item => ({
            itemId: item.id,
            quantity: item.quantity,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      setState("success")
      toast({
        title: "Success",
        description: `All items have been added to ${bayLabel}`,
      })
    } catch (error) {
      console.error("Error adding stock:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add stock. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle any barcode input (from camera or keyboard)
  const handleBarcodeInput = async (code: string) => {
    if (state === "scanning_bay") {
      await handleBayScan(code)
    } else if (state === "scanning_items") {
      await handleItemScan(code)
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
    console.log("[PUTAWAY] Handling item scan:", code)
    console.log("[PUTAWAY] Current scanned items:", scannedItems)
    setIsScanning(false)
    
    try {
      const response = await fetch(`/api/items/barcode/${code}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          // Item not found, show dialog to add new item
          console.log("[PUTAWAY] Item not found, opening new item dialog")
          setNewItem({ barcode: code, sku: "", name: "" })
          setIsNewItemDialogOpen(true)
        } else {
          throw new Error("Failed to check item")
        }
        return
      }

      const item = await response.json()
      console.log("[PUTAWAY] Item found:", item)
      const scannedItem: ScannedItem = {
        id: item.id,
        sku: item.sku,
        name: item.name,
        barcode: item.barcode,
        quantity: 1
      }
      
      setCurrentItem(scannedItem)
      setState("confirming_item")
      toast({
        title: "Item Found",
        description: `Found item: ${item.name}. Please confirm this is correct.`,
      })
    } catch (error) {
      console.error("[PUTAWAY] Error checking item:", error)
      toast({
        title: "Error",
        description: "Failed to process barcode. Please try again.",
        variant: "destructive",
      })
      setIsScanning(true)
    }
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

  // Handle new item submission
  const handleAddNewItem = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("[PUTAWAY] handleAddNewItem triggered")
    console.log("[PUTAWAY] Current state before submission:", {
      state,
      currentItem,
      isScanning,
      isNewItemDialogOpen,
      isSubmitting,
      newItem
    })

    if (isSubmitting) {
      console.log("[PUTAWAY] Already submitting, preventing double submission")
      return
    }

    try {
      setIsSubmitting(true)
      console.log("[PUTAWAY] Set isSubmitting to true")

      if (!newItem.barcode || !newItem.name) {
        console.error("[PUTAWAY] Missing required fields")
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        })
        return
      }

      console.log("[PUTAWAY] Sending POST request with data:", newItem)
      const response = await fetch("/api/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newItem),
      })

      const data = await response.json()
      console.log("[PUTAWAY] API response received:", data)

      if (!response.ok) {
        throw new Error(data.message || "Failed to create item")
      }

      console.log("[PUTAWAY] Creating scanned item from response")
      const scannedItem: ScannedItem = {
        id: data.id,
        sku: data.sku,
        name: data.name,
        barcode: data.barcode,
        quantity: 1
      }

      // Important: Update all states in a specific order
      console.log("[PUTAWAY] Beginning state updates")
      
      // 1. Update the current item first
      setCurrentItem(scannedItem)
      
      // 2. Close the dialog and reset form
      setIsNewItemDialogOpen(false)
      setNewItem({ barcode: "", sku: "", name: "" })
      
      // 3. Update the page state
      setState("confirming_item")
      
      console.log("[PUTAWAY] State updates complete")
      
      toast({
        title: "Success",
        description: "Item created successfully.",
      })
    } catch (error) {
      console.error("[PUTAWAY] Error in handleAddNewItem:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add item. Please try again.",
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

  // Add this useEffect to monitor state changes
  useEffect(() => {
    console.log("[PUTAWAY] State changed:", {
      state,
      currentItem,
      isScanning,
      isNewItemDialogOpen,
      isSubmitting
    })
  }, [state, currentItem, isScanning, isNewItemDialogOpen, isSubmitting])

  // Debug logging for initial mount and all state changes
  useEffect(() => {
    console.log("[PUTAWAY] Component mounted")
    return () => console.log("[PUTAWAY] Component unmounted")
  }, [])

  useEffect(() => {
    console.log("[PUTAWAY] State changed:", {
      state,
      currentItem,
      isScanning,
      isNewItemDialogOpen,
      isSubmitting,
      newItem
    })
  }, [state, currentItem, isScanning, isNewItemDialogOpen, isSubmitting, newItem])

  return (
    <div className="container mx-auto p-4">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-center">
          {state === "ready_to_scan_bay" && "Ready to Scan Bay"}
          {state === "scanning_bay" && "Scanning Bay"}
          {state === "confirming_bay" && "Confirm Bay Location"}
          {state === "ready_to_scan_items" && "Ready to Scan Items"}
          {state === "scanning_items" && "Scanning Items"}
          {state === "confirming_item" && "Confirm Item"}
          {state === "reviewing_items" && "Review Items"}
          {state === "confirming_putaway" && "Confirm Putaway"}
          {state === "success" && "Putaway Complete"}
        </h1>

        {/* Ready to scan bay state */}
        {state === "ready_to_scan_bay" && (
          <div className="space-y-4">
            <p className="text-center text-muted-foreground">
              Click scan to begin scanning a bay location
            </p>
            <div className="flex justify-center">
              <Button onClick={startScanning}>
                Scan Bay
              </Button>
            </div>
          </div>
        )}

        {/* Bay confirmation state */}
        {state === "confirming_bay" && (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bay Label:</span>
                <span className="font-medium">{bayLabel}</span>
              </div>
            </div>
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => handleBayConfirmation(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleBayConfirmation(true)}
              >
                Confirm Bay
              </Button>
            </div>
          </div>
        )}

        {/* Ready to scan items state */}
        {state === "ready_to_scan_items" && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-muted-foreground">Bay: {bayLabel}</p>
              <p className="text-muted-foreground">
                {scannedItems.length === 0 
                  ? "Click scan to begin scanning items"
                  : "Click scan to add more items"}
              </p>
            </div>
            
            {/* Show scanned items if any */}
            {scannedItems.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Scanned Items:</h2>
                <div className="space-y-2">
                  {scannedItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.sku}</p>
                      </div>
                      <div className="flex items-center gap-2">
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-2">
              <Button onClick={startScanning}>
                Scan Item
              </Button>
              {scannedItems.length > 0 && (
                <Button variant="secondary" onClick={() => setState("reviewing_items")}>
                  Review All Items
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Scanning states (bay or items) */}
        {(state === "scanning_bay" || state === "scanning_items") && (
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              <Button
                variant="secondary"
                onClick={stopScanning}
              >
                Cancel Scan
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

            <div className="w-full max-w-lg mx-auto">
              <CameraScanner
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
                  if (state === "scanning_bay") {
                    setState("ready_to_scan_bay")
                  } else {
                    setState("ready_to_scan_items")
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Item confirmation state */}
        {state === "confirming_item" && (
          <div className="space-y-4">
            {currentItem ? (
              <>
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
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 text-center"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(quantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center gap-2">
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
              </>
            ) : (
              <div className="text-center text-muted-foreground">
                <p>Loading item details...</p>
                <p className="text-sm">Bay: {bayLabel}</p>
                <p className="text-sm">Items scanned so far: {scannedItems.length}</p>
              </div>
            )}
          </div>
        )}

        {/* Review items state */}
        {state === "reviewing_items" && (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg space-y-4">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Bay Location:</span>
                <span className="font-medium">{bayLabel}</span>
              </div>
              <div className="space-y-2">
                {scannedItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.sku}</p>
                    </div>
                    <div className="flex items-center gap-2">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setState("ready_to_scan_items")}
              >
                Back
              </Button>
              <Button
                onClick={() => setState("confirming_putaway")}
                disabled={scannedItems.length === 0}
              >
                Confirm All Items
              </Button>
            </div>
          </div>
        )}

        {/* Final confirmation state */}
        {state === "confirming_putaway" && (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg space-y-4">
              <p className="text-center text-muted-foreground">
                Please confirm you want to add the following items to {bayLabel}:
              </p>
              <div className="space-y-2">
                {scannedItems.map((item) => (
                  <div key={item.id} className="flex justify-between p-2 border rounded-lg">
                    <span>{item.name}</span>
                    <span className="font-medium">Qty: {item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setState("reviewing_items")}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                onClick={handleFinalPutaway}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Confirm Putaway"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Success state */}
        {state === "success" && (
          <div className="space-y-4 text-center">
            <p className="text-green-600 dark:text-green-400">
              Successfully added {scannedItems.length} items to {bayLabel}
            </p>
            <div className="flex justify-center gap-2">
              <Button
                onClick={() => {
                  setState("ready_to_scan_bay")
                  setBayLabel("")
                  setScannedItems([])
                  setCurrentItem(null)
                  setQuantity(1)
                }}
              >
                Start New Putaway
              </Button>
            </div>
          </div>
        )}

        {/* Existing dialogs */}
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

        {/* New Item Dialog */}
        <Dialog 
          open={isNewItemDialogOpen} 
          onOpenChange={(open) => {
            console.log("[PUTAWAY] Dialog state changing to:", open)
            if (!open && !isSubmitting) {  // Only close if not submitting
              console.log("[PUTAWAY] Dialog closing, resetting states")
              setIsScanning(true)
              setNewItem({ barcode: "", sku: "", name: "" })
              setIsNewItemDialogOpen(false)
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Item</DialogTitle>
            </DialogHeader>
            <form 
              onSubmit={(e) => {
                console.log("[PUTAWAY] Form submit event triggered")
                e.preventDefault() // Prevent default here to ensure it's always called
                if (!isSubmitting) {
                  handleAddNewItem(e)
                }
              }} 
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode</Label>
                <Input
                  id="barcode"
                  value={newItem.barcode}
                  onChange={(e) => setNewItem(prev => ({ ...prev, barcode: e.target.value }))}
                  placeholder="Enter barcode"
                  required
                  readOnly
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU (Optional)</Label>
                <Input
                  id="sku"
                  value={newItem.sku}
                  onChange={(e) => setNewItem(prev => ({ ...prev, sku: e.target.value }))}
                  placeholder="Enter SKU"
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
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!isSubmitting) {
                      console.log("[PUTAWAY] Cancel button clicked")
                      setIsNewItemDialogOpen(false)
                      setIsScanning(true)
                    }
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Item"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
} 