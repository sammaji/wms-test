"use client"

import { useState } from "react"
import { Keyboard } from "lucide-react"
import { CameraScanner } from "./camera-scanner"

interface BarcodeScannerProps {
  isOpen: boolean
  onClose: () => void
  onScan: (barcode: string) => void
}

export function BarcodeScanner({ 
  isOpen,
  onClose,
  onScan,
}: BarcodeScannerProps) {
  const [lastScanned, setLastScanned] = useState("")

  const handleScan = (barcode: string) => {
    if (barcode === lastScanned) return
    console.log("BarcodeScanner: Scan received", barcode)
    setLastScanned(barcode)
    onScan(barcode)
    onClose()
  }

  return (
    <div className="relative w-full h-full">
      <CameraScanner
        isScanning={isOpen}
        onScan={handleScan}
        className="w-full"
      />
      
      <div className="absolute bottom-0 left-0 right-0 p-2 text-center">
        <p className="text-sm text-muted-foreground">
          <Keyboard className="h-4 w-4 inline-block mr-2" />
          You can also use a barcode scanner gun
        </p>
      </div>
    </div>
  )
} 