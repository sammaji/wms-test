"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, CameraOff, RefreshCcw } from "lucide-react"
import { Button } from "./ui/button"
import { cn } from "@/lib/utils"
import { getInstance, scanImageData } from '@undecaf/zbar-wasm'

interface CameraScannerProps {
  isScanning: boolean
  onScan: (barcode: string) => void
  onError?: (error: Error) => void
  className?: string
}

export function CameraScanner({
  isScanning,
  onScan,
  onError,
  className
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef<boolean>(false)
  
  const [error, setError] = useState<string | null>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const addDebugInfo = (info: string) => {
    setDebugInfo(prev => [...prev.slice(-4), info]) // Keep last 5 messages
  }

  // Start camera
  const startCamera = async () => {
    try {
      addDebugInfo("Starting camera...")
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setError(null)
        setHasPermission(true)
        addDebugInfo("Camera started successfully")
        startScanning()
      }
    } catch (err) {
      console.error("Camera error:", err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      addDebugInfo(`Camera error: ${errorMessage}`)
      
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setHasPermission(false)
      } else {
        setError("Failed to start camera")
      }
      onError?.(err as Error)
    }
  }

  // Stop camera
  const stopCamera = () => {
    scanningRef.current = false
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setDebugInfo([])
  }

  // Start scanning loop
  const startScanning = async () => {
    try {
      addDebugInfo("Initializing scanner...")
      // Initialize zbar
      await getInstance()
      scanningRef.current = true
      addDebugInfo("Scanner initialized, starting scan loop")
      scanFrame()
    } catch (err) {
      console.error("Failed to initialize scanner:", err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      addDebugInfo(`Scanner init error: ${errorMessage}`)
      setError("Failed to initialize scanner")
      onError?.(err as Error)
    }
  }

  // Scan a single frame
  const scanFrame = async () => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    if (!ctx || video.videoWidth === 0) {
      if (scanningRef.current) {
        requestAnimationFrame(scanFrame)
      }
      return
    }

    // Match canvas size to video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw current frame
    ctx.drawImage(video, 0, 0)

    try {
      // Get image data and scan for barcodes
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const results = await scanImageData(imageData)

      // Process results
      for (const symbol of results) {
        const decoded = symbol.decode()
        if (decoded) {
          addDebugInfo(`Barcode found: ${decoded}`)
          onScan(decoded)
          return // Stop scanning after first successful decode
        }
      }
    } catch (err) {
      // Log scanning errors but continue
      const errorMessage = err instanceof Error ? err.message : String(err)
      addDebugInfo(`Scan error: ${errorMessage}`)
    }

    // Continue scanning
    if (scanningRef.current) {
      requestAnimationFrame(scanFrame)
    }
  }

  // Handle retry
  const handleRetry = () => {
    setError(null)
    setHasPermission(null)
    setDebugInfo([])
    startCamera()
  }

  // Handle scanning state changes
  useEffect(() => {
    if (isScanning) {
      startCamera()
    } else {
      stopCamera()
    }
    
    return () => {
      stopCamera()
    }
  }, [isScanning])

  // Render error state
  if (error || hasPermission === false) {
    return (
      <div className={cn(
        "relative w-full bg-black rounded-lg overflow-hidden",
        "aspect-[4/3] flex items-center justify-center",
        className
      )}>
        <div className="text-center text-white space-y-4">
          {hasPermission === false ? (
            <>
              <Camera className="h-12 w-12 mx-auto" />
              <p>Camera permission denied</p>
            </>
          ) : (
            <>
              <CameraOff className="h-12 w-12 mx-auto" />
              <p>{error}</p>
            </>
          )}
          <Button onClick={handleRetry} variant="outline">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
          {/* Debug info */}
          <div className="text-xs text-white/70 mt-4 space-y-1">
            {debugInfo.map((info, i) => (
              <p key={i}>{info}</p>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Render camera view
  return (
    <div 
      className={cn(
        "relative w-full bg-black rounded-lg overflow-hidden",
        "aspect-[4/3]",
        className
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      
      <canvas
        ref={canvasRef}
        className="hidden"
      />
      
      {/* Scanning guide overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-x-[10%] top-[30%] bottom-[30%] border-2 border-white/30 rounded-lg">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-white/50 animate-scan" />
        </div>
      </div>

      {/* Debug overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2">
        <div className="text-xs text-white/70 space-y-1">
          {debugInfo.map((info, i) => (
            <p key={i}>{info}</p>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {!videoRef.current?.srcObject && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white">Initializing camera...</div>
        </div>
      )}
    </div>
  )
} 