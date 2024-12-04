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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

interface MultipleCompanyResponse {
  multipleCompanies: true
  items: Array<{
    id: string
    sku: string
    name: string
    barcode: string
    companyId: string
    companyCode: string
  }>
}

export default function PutawayPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const itemId = searchParams.get("itemId")
  const bayFromUrl = searchParams.get("bay")
  const itemsFromUrl = searchParams.get("items")
  const isNewItem = searchParams.get("newItem") === "true"

  // State declarations
  const [state, setState] = useState<PutawayState>(() => {
    // If we have a bay from URL, start with scanning items
    if (bayFromUrl) {
      return "ready_to_scan_items"
    }
    // Otherwise start with scanning bay
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
        const items = JSON.parse(decodeURIComponent(itemsFromUrl))
        return items
      } catch (e) {
        return []
      }
    }
    return []
  })

  // Add state for company selection
  const [companySelectionItems, setCompanySelectionItems] = useState<MultipleCompanyResponse["items"] | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)

  // Add state for companies
  const [companies, setCompanies] = useState<Array<{ id: string, code: string }>>([])
  const [selectedCompanyForNewItem, setSelectedCompanyForNewItem] = useState<string>("")

  // Fetch companies when dialog opens
  useEffect(() => {
    const fetchCompanies = async () => {
      if (isNewItemDialogOpen) {
        try {
          const response = await fetch('/api/companies')
          if (!response.ok) throw new Error('Failed to fetch companies')
          const data = await response.json()
          setCompanies(data)
          // If there's only one company, auto-select it
          if (data.length === 1) {
            setSelectedCompanyForNewItem(data[0].id)
          }
        } catch (error) {
          console.error('Failed to fetch companies:', error)
          toast({
            title: "Error",
            description: "Failed to load companies. Please try again.",
            variant: "destructive",
          })
        }
      }
    }
    fetchCompanies()
  }, [isNewItemDialogOpen])

  // Fetch item effect
  useEffect(() => {
    const fetchItemIfNeeded = async () => {
      if (!itemId) {
        return
      }

      try {
        const response = await fetch(`/api/items/${itemId}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch item: ${await response.text()}`)
        }

        const item = await response.json()

        const scannedItem = {
          id: item.id,
          sku: item.sku,
          name: item.name,
          barcode: item.barcode,
          quantity: 1
        }

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
    if (confirmed && currentItem) {
      // Add item to scanned items list
      const itemToAdd = { ...currentItem, quantity }
      
      setScannedItems(prev => {
        const updated = [...prev, itemToAdd]
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
        try {
          const response = await fetch(`/api/items/${itemId}`)
          const item = await response.json()

          const newItem = {
            id: item.id,
            sku: item.sku,
            name: item.name,
            barcode: item.barcode,
            quantity: 1
          }

          setScannedItems(prev => {
            const updated = [...prev, newItem]
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
    if (state === "ready_to_scan_bay") {
      setState("scanning_bay")
    } else if (state === "ready_to_scan_items") {
      setState("scanning_items")
    }
    setIsScanning(true)
  }

  // Stop scanning
  const stopScanning = () => {
    setIsScanning(false)
    // Reset to ready state based on current context
    if (state === "scanning_bay") {
      setState("ready_to_scan_bay")
    } else if (state === "scanning_items") {
      setState("ready_to_scan_items")
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

  // Handle bay confirmation
  const handleBayConfirmation = (confirmed: boolean) => {
    if (confirmed) {
      setState("ready_to_scan_items")
      setIsScanning(false)
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
    // Only process if we're in a scanning state
    if (state !== "scanning_bay" && state !== "scanning_items") {
      return
    }
    
    if (state === "scanning_bay") {
      await handleBayScan(code)
    } else if (state === "scanning_items") {
      await handleItemScan(code)
    }
  }

  // Handle bay barcode scan
  const handleBayScan = async (code: string) => {
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
    try {
      const response = await fetch(`/api/items/barcode/${code}`)
      
      if (response.status === 404) {
        setNewItem({ barcode: code, sku: "", name: "" })
        setIsNewItemDialogOpen(true)
        setIsScanning(false)
        return
      }

      const data = await response.json()
      
      // Important: Stop scanning immediately after getting a response
      setIsScanning(false)

      if (response.status === 300 && "multipleCompanies" in data) {
        // Multiple companies have this item, show company selection
        setCompanySelectionItems(data.items)
        return
      }

      // Single item found - explicitly set states in the correct order
      const scannedItem = {
        id: data.id,
        sku: data.sku,
        name: data.name,
        barcode: data.barcode,
        quantity: 1
      }
      
      setCurrentItem(scannedItem)
      
      setState("confirming_item")
      
      toast({
        title: "Item Found",
        description: `Found item: ${data.name}. Please confirm this is correct.`,
      })
    } catch (error) {
      console.error("[PUTAWAY] Error checking item:", error)
      setState("ready_to_scan_items")
      setIsScanning(false)
    }
  }

  const handleItemFound = (item: any) => {
    const scannedItem = {
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
  }

  // Handle manual dialog
  const openManualDialog = () => {
    setIsScanning(false)
    setIsManualDialogOpen(true)
  }

  const closeManualDialog = () => {
    setManualInput("")
    setIsManualDialogOpen(false)
  }

  // Handle manual input submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!manualInput) {
      return
    }

    // Process the manual input
    handleBarcodeInput(manualInput)
    
    // Clear the input and close dialog
    closeManualDialog()
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
    
    if (isSubmitting) {
      return
    }

    if (!selectedCompanyForNewItem) {
      toast({
        title: "Error",
        description: "Please select a company",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)

      if (!newItem.barcode || !newItem.name) {
        console.error("[PUTAWAY] Missing required fields")
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        })
        return
      }

      console.log("[PUTAWAY] Sending POST request with data:", { ...newItem, companyId: selectedCompanyForNewItem })
      const response = await fetch("/api/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newItem,
          companyId: selectedCompanyForNewItem
        }),
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
      setCurrentItem(scannedItem)
      
      setIsNewItemDialogOpen(false)
      setNewItem({ barcode: "", sku: "", name: "" })
      setSelectedCompanyForNewItem("")
      
      setState("confirming_item")
      
      toast({
        title: "Success",
        description: "Item created successfully.",
      })
    } catch (error: unknown) {
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
          handleBarcodeInput(buffer)
          buffer = "" // Clear buffer after processing
        }
        return
      }

      // Add character to buffer
      buffer += e.key

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

  // Handle dialog close events
  const handleNewItemDialogClose = (open: boolean) => {
    if (!open && !isSubmitting) {
      setState("ready_to_scan_items")
      setNewItem({ barcode: "", sku: "", name: "" })
      setSelectedCompanyForNewItem("")
      setIsNewItemDialogOpen(false)
    }
  }

  const handleNewLocationDialogClose = (open: boolean) => {
    if (!open && !isSubmitting) {
      setState("ready_to_scan_bay")
      setPendingLabel("")
      setNewLocation({
        aisle: "",
        bay: "",
        height: "",
        type: "BAY"
      })
      setIsNewLocationDialogOpen(false)
    }
  }

  const handleCompanySelectionDialogClose = (open: boolean) => {
    if (!open) {
      setCompanySelectionItems(null)
      setSelectedCompanyId(null)
      setState("ready_to_scan_items")
    }
  }

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
              <Button 
                variant="outline"
                onClick={openManualDialog}
              >
                Enter Manually
              </Button>
            </div>

            {/* Manual Entry Dialog */}
            <Dialog 
              open={isManualDialogOpen} 
              onOpenChange={closeManualDialog}
            >
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
                      autoFocus
                    />
                  </div>
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={closeManualDialog}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={!manualInput}>
                      Submit
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

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
        <Dialog open={isNewLocationDialogOpen} onOpenChange={handleNewLocationDialogClose}>
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
                    handleNewLocationDialogClose(true)
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
          onOpenChange={handleNewItemDialogClose}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Item</DialogTitle>
            </DialogHeader>
            <form 
              onSubmit={(e) => {
                e.preventDefault()
                if (!isSubmitting) {
                  handleAddNewItem(e)
                }
              }} 
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Select
                  value={selectedCompanyForNewItem}
                  onValueChange={setSelectedCompanyForNewItem}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                      handleNewItemDialogClose(true)
                      setIsScanning(true)
                    }
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting || !selectedCompanyForNewItem}
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

        {/* Company Selection Dialog */}
        <Dialog 
          open={!!companySelectionItems} 
          onOpenChange={handleCompanySelectionDialogClose}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select Company</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This item exists in multiple companies. Please select the correct company:
              </p>
              <Select
                value={selectedCompanyId || ""}
                onValueChange={(value) => {
                  setSelectedCompanyId(value)
                  const selectedItem = companySelectionItems?.find(item => item.companyId === value)
                  if (selectedItem) {
                    handleItemFound(selectedItem)
                    setCompanySelectionItems(null)
                    setSelectedCompanyId(null)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companySelectionItems?.map((item) => (
                    <SelectItem key={item.companyId} value={item.companyId}>
                      {item.companyCode} - {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
} 