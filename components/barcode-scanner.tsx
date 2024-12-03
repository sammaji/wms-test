"use client"

import { useState } from "react"
import { Keyboard } from "lucide-react"
import { CameraScanner } from "./camera-scanner"
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner"

interface BarcodeScannerProps {
  isScanning: boolean
  onScan: (barcode: string) => void
  onError?: (error: Error) => void
  showKeyboardHint?: boolean
  showGuides?: boolean
  showStatus?: boolean
}

export function BarcodeScanner({ 
  isScanning,
  onScan,
  onError = (error: Error) => console.error("Scanner error:", error),
  showKeyboardHint = true,
  showGuides = true,
  showStatus = true,
}: BarcodeScannerProps) {
  const [lastScanned, setLastScanned] = useState("")

  // Use the barcode scanner hook for consistent scanning behavior
  const { handleSuccessfulScan } = useBarcodeScanner({
    onScan,
    onError,
    isEnabled: isScanning,
    scannerType: "keyboard", // Camera scanning is handled by CameraScanner
  })

  // Handle camera scan
  const handleCameraScan = (barcode: string) => {
    if (barcode === lastScanned) return
    setLastScanned(barcode)
    onScan(barcode)
  }

  return (
    <div className="relative w-full h-full">
      <CameraScanner
        isScanning={isScanning}
        onScan={handleCameraScan}
        onError={onError}
        showGuides={showGuides}
        showStatus={showStatus}
      />
      
      {showKeyboardHint && (
        <div className="absolute bottom-0 left-0 right-0 p-2 text-center">
          <p className="text-sm text-muted-foreground">
            <Keyboard className="h-4 w-4 inline-block mr-2" />
            You can also use a barcode scanner gun
          </p>
        </div>
      )}
    </div>
  )
} 