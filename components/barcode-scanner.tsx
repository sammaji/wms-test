"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Html5Qrcode, Html5QrcodeSupportedFormats, QrcodeResultFormat } from "html5-qrcode"
import { debounce } from "lodash"

interface BarcodeScannerProps {
  isOpen: boolean
  onClose: () => void
  onScan: (barcode: string) => void
  isScanning: boolean
}

interface ScanResult {
  barcode: string
  format: {
    format: number
    formatName: string
  }
}

// Separate logging concern
const serverLog = async (message: string, data?: any) => {
  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, data })
    })
  } catch (error) {
    console.error('Failed to send log to server:', error)
  }
}

// Helper function to convert QrcodeResultFormat to ScanResult format
const formatQRCodeResult = (format: QrcodeResultFormat | undefined): ScanResult['format'] => {
  if (!format) {
    return {
      format: -1,
      formatName: 'UNKNOWN'
    }
  }
  return {
    format: format.format,
    formatName: format.formatName
  }
}

export function BarcodeScanner({ 
  isOpen,
  onClose,
  onScan,
  isScanning
}: BarcodeScannerProps) {
  const [preview, setPreview] = useState<string>("")
  const [cameraError, setCameraError] = useState<string>("")
  
  // Refs for managing scanner state
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isScanningRef = useRef(false)
  const lastResultRef = useRef<string>("")
  const isProcessingRef = useRef(false)

  // Debounced preview update to prevent flooding
  const updatePreview = useCallback(
    debounce((text: string) => {
      if (text !== preview) {
        setPreview(text)
      }
    }, 200),
    [preview]
  )

  // Clean up scanner instance
  const cleanupScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current = null
        lastResultRef.current = ""
        isProcessingRef.current = false
      } catch (error) {
        console.error('Error cleaning up scanner:', error)
      }
    }
  }, [])

  // Process scan result
  const processScanResult = useCallback(async (result: ScanResult): Promise<void> => {
    // Prevent processing if already handling a scan or same barcode
    if (isProcessingRef.current || result.barcode === lastResultRef.current) {
      return
    }

    lastResultRef.current = result.barcode
    
    // Log scan with current state
    await serverLog("Barcode detected", {
      barcode: result.barcode,
      format: result.format,
      isScanning: isScanningRef.current,
      mode: isScanningRef.current ? "scanning" : "preview"
    })

    if (isScanningRef.current) {
      isProcessingRef.current = true
      try {
        // Stop scanner before processing to prevent more scans
        await cleanupScanner()
        await onScan(result.barcode)
      } catch (error) {
        console.error('Error processing scan:', error)
        isProcessingRef.current = false
        lastResultRef.current = ""
      }
    } else {
      // Update preview with debouncing
      updatePreview(result.barcode)
    }
  }, [onScan, updatePreview, cleanupScanner])

  // Initialize scanner
  const initScanner = useCallback(async () => {
    if (scannerRef.current) return

    try {
      const scanner = new Html5Qrcode("reader", {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13
        ],
        verbose: false
      })

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 100 },
          aspectRatio: 4/3,
        },
        async (decodedText, decodedResult) => {
          const result: ScanResult = {
            barcode: decodedText,
            format: formatQRCodeResult(decodedResult?.result?.format)
          }
          await processScanResult(result)
        },
        // Silent error handling for preview mode
        () => {}
      )

      scannerRef.current = scanner
      setCameraError("")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Camera initialization failed"
      setCameraError(errorMessage)
      console.error('Scanner initialization error:', error)
    }
  }, [processScanResult])

  // Handle scanning mode changes
  useEffect(() => {
    isScanningRef.current = isScanning
    lastResultRef.current = ""
    isProcessingRef.current = false
    setPreview("")
    
    // Log mode change
    serverLog("Scanning mode changed", { isScanning })
  }, [isScanning])

  // Handle component lifecycle
  useEffect(() => {
    if (!isOpen) return

    initScanner()
    return () => {
      cleanupScanner()
      updatePreview.cancel()
    }
  }, [isOpen, initScanner, cleanupScanner, updatePreview])

  if (!isOpen) return null

  return (
    <div className="relative w-full">
      <div className="relative w-full aspect-[4/3] bg-black rounded-lg overflow-hidden">
        {/* Scanner container */}
        <div id="reader" className="w-full h-full" />

        {/* Error message */}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/50 text-white text-sm px-4 py-2 rounded max-w-[80%] text-center">
              {cameraError}
            </div>
          </div>
        )}

        {/* Hide default UI elements */}
        <style jsx global>{`
          #reader {
            border: none !important;
            width: 100% !important;
            height: 100% !important;
          }
          video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
          }
        `}</style>

        {/* Preview overlay */}
        {preview && !isScanning && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <div className="bg-black/50 text-white text-sm px-3 py-1 rounded">
              {preview}
            </div>
          </div>
        )}

        {/* Status message */}
        <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm">
          {isScanning ? "Scanning..." : "Center barcode in box"}
        </div>
      </div>
    </div>
  )
} 