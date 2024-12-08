"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"

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
  const [barcodeInput, setBarcodeInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const [shouldManageFocus, setShouldManageFocus] = useState(true)

  // Function to focus the input
  const focusInput = () => {
    if (inputRef.current && shouldManageFocus) {
      inputRef.current.focus({ preventScroll: true })
    }
  }

  // Keep input focused at all times
  useEffect(() => {
    // Initial focus
    focusInput()

    // Set up an interval to check focus
    const interval = setInterval(() => {
      // Check if any dialog is open
      const hasOpenDialog = document.querySelector('[role="dialog"]') !== null
      if (hasOpenDialog && shouldManageFocus) {
        setShouldManageFocus(false)
      } else if (!hasOpenDialog && !shouldManageFocus) {
        setShouldManageFocus(true)
      }

      // Only focus if we should manage focus
      if (shouldManageFocus) {
        focusInput()
      }
    }, 100)

    // Focus when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && shouldManageFocus) {
        focusInput()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [shouldManageFocus])

  const processBarcode = async (barcode: string) => {
    if (isProcessing) return
    setIsProcessing(true)

    try {
      await serverLog("Processing barcode in putaway form", { barcode })
      
      // Validate the barcode format
      const pattern = /^[A-Za-z]{1,2}-\d{2}-\d{2}$/
      if (!pattern.test(barcode)) {
        await serverLog("Invalid barcode format", { barcode })
        toast({
          title: "Invalid Format",
          description: "Location code must be in format: YY-XX-ZZ (e.g., A-01-02 or AB-01-02)",
          variant: "destructive",
        })
        return
      }

      // Show success toast
      toast({
        title: "Location Scanned",
        description: `Successfully scanned location: ${barcode}`,
      })

      const normalizedBarcode = barcode.toUpperCase()
      const url = `/stock/putaway?location=${encodeURIComponent(normalizedBarcode)}`
      
      await serverLog("Navigating to putaway page", { 
        barcode: normalizedBarcode,
        url
      })
      
      // Use push instead of replace to maintain history
      router.push(url, { scroll: false })
    } catch (error) {
      await serverLog("Error processing barcode", { error })
      toast({
        title: "Error",
        description: "Failed to process barcode",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
      setBarcodeInput("")
      // Refocus the input
      focusInput()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcodeInput.trim()) return
    processBarcode(barcodeInput.trim())
  }

  // Handle input change - automatically submit if it ends with Enter
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setBarcodeInput(value)
    
    // If the input ends with a newline character (Enter key from barcode scanner)
    if (value.endsWith('\n')) {
      const cleanValue = value.replace('\n', '').trim()
      if (cleanValue) {
        setBarcodeInput(cleanValue)
        processBarcode(cleanValue)
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Putaway Process</h2>
        <p className="text-sm text-muted-foreground">
          Scan the bay location you are putting stock into
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            inputMode="none"
            value={barcodeInput}
            onChange={handleInputChange}
            placeholder="Ready for scanning..."
            className="w-full text-lg py-6 text-center bg-muted border rounded-md"
            disabled={isProcessing}
            autoComplete="off"
          />
          {isProcessing && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => router.push('/stock/putaway')}
          disabled={isProcessing}
        >
          Cancel
        </Button>
      </form>
    </div>
  )
} 