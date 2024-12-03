import { useState, useEffect, useRef } from "react"

interface UseBarcodeScanner {
  onScan: (barcode: string) => void
  onError?: (error: Error) => void
  isEnabled?: boolean
  scannerType?: "camera" | "keyboard" | "both"
  bufferDuration?: number
  requiredScans?: number
}

export function useBarcodeScanner({
  onScan,
  onError,
  isEnabled = true,
  scannerType = "both",
  bufferDuration = 50,
  requiredScans = 3,
}: UseBarcodeScanner) {
  const [lastScanned, setLastScanned] = useState<string>("")
  const bufferRef = useRef<string[]>([])
  const keyboardBufferRef = useRef("")
  const timeoutRef = useRef<NodeJS.Timeout>()

  // Handle successful scan
  const handleSuccessfulScan = (code: string) => {
    if (code === lastScanned) return
    
    bufferRef.current.push(code)
    if (bufferRef.current.length > requiredScans) {
      bufferRef.current.shift()
    }

    if (
      bufferRef.current.length === requiredScans &&
      bufferRef.current.every((scan) => scan === code)
    ) {
      setLastScanned(code)
      onScan(code)
      bufferRef.current = []

      // Provide feedback
      if (navigator.vibrate) {
        navigator.vibrate(200)
      }
    }
  }

  // Handle keyboard scanner
  useEffect(() => {
    if (!isEnabled || !["keyboard", "both"].includes(scannerType)) return

    const handleKeyPress = (e: KeyboardEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      if (e.key === 'Enter') {
        if (keyboardBufferRef.current.length > 0) {
          handleSuccessfulScan(keyboardBufferRef.current)
          keyboardBufferRef.current = ""
        }
        return
      }

      keyboardBufferRef.current += e.key

      timeoutRef.current = setTimeout(() => {
        keyboardBufferRef.current = ""
      }, bufferDuration)
    }

    window.addEventListener('keypress', handleKeyPress)

    return () => {
      window.removeEventListener('keypress', handleKeyPress)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isEnabled, scannerType, bufferDuration])

  return {
    lastScanned,
    handleSuccessfulScan,
    resetLastScanned: () => setLastScanned(""),
  }
} 