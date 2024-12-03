"use client"

import { useEffect, useRef, useState } from "react"
import Quagga from '@ericblade/quagga2'
import { Camera, CameraOff, RefreshCcw } from "lucide-react"
import { Button } from "./ui/button"

const log = (message: string, data?: any) => {
  console.log(`[CameraScanner] ${message}`, data || '')
}

interface CameraScannerProps {
  isScanning: boolean
  onScan: (barcode: string) => void
  onError: (error: Error) => void
  showGuides?: boolean
  showStatus?: boolean
}

export function CameraScanner({ 
  isScanning, 
  onScan, 
  onError,
  showGuides = true,
  showStatus = true,
}: CameraScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mountedRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)

  const [hasCamera, setHasCamera] = useState(true)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [initializationAttempts, setInitializationAttempts] = useState(0)

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const initScanner = async () => {
    log('Initializing scanner...')
    if (!scannerRef.current) {
      log('Scanner ref not ready')
      return
    }

    try {
      // Stop any existing stream
      stopStream()

      // Request camera access first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { min: 360, ideal: 720, max: 1920 },
          height: { min: 360, ideal: 720, max: 1080 },
        },
        audio: false
      })

      // Store the stream reference
      streamRef.current = stream

      // Wait for video element to be ready
      const videoElement = document.createElement('video')
      videoElement.srcObject = stream
      await new Promise((resolve) => {
        videoElement.onloadedmetadata = () => resolve(true)
      })

      // Initialize Quagga with the active stream
      await new Promise((resolve, reject) => {
        Quagga.init(
          {
            inputStream: {
              name: "Live",
              type: "LiveStream",
              target: scannerRef.current!,
              constraints: {
                facingMode: "environment",
                aspectRatio: { min: 1, max: 2 },
                width: { min: 360, ideal: 720, max: 1920 },
                height: { min: 360, ideal: 720, max: 1080 },
              },
              area: {
                top: "0%",
                right: "0%",
                left: "0%",
                bottom: "0%",
              },
              singleChannel: false,
            },
            locator: {
              patchSize: "medium",
              halfSample: true,
            },
            numOfWorkers: 2,
            decoder: {
              readers: [
                "ean_reader",
                "ean_8_reader",
                "code_128_reader",
                "code_39_reader",
                "upc_reader",
                "upc_e_reader",
              ],
              debug: {
                drawBoundingBox: true,
                showPattern: true,
                drawScanline: true,
              },
              multiple: false,
            },
            locate: true,
            frequency: 10,
          },
          (err) => {
            if (err) {
              log('Scanner initialization error:', err)
              reject(err)
              return
            }
            resolve(true)
          }
        )
      })

      log('Scanner initialized successfully')
      await Quagga.start()
      log('Scanner started')
      setIsLoading(false)
      setHasCamera(true)
      setPermissionDenied(false)

      // Set up image processing handlers
      Quagga.onProcessed((result) => {
        if (!result?.codeResult) return

        const ctx = Quagga.canvas.ctx.overlay
        const canvas = Quagga.canvas.dom.overlay

        if (!ctx || !canvas) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        
        if (result.boxes) {
          result.boxes
            .filter((box) => box !== result.box)
            .forEach((box) => {
              Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, ctx, { color: "yellow", lineWidth: 2 })
            })
        }

        if (result.box) {
          Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, ctx, { color: "green", lineWidth: 2 })
        }

        if (result.codeResult?.code) {
          Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, ctx, { color: "red", lineWidth: 3 })
        }
      })

      // Set up detection handler
      Quagga.onDetected((result) => {
        if (!result?.codeResult?.code) return
        onScan(result.codeResult.code)
      })

    } catch (error) {
      log('Error in initScanner:', error)
      stopStream()
      
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
          case 'PermissionDeniedError':
            setPermissionDenied(true)
            setHasCamera(true)
            break
          case 'NotFoundError':
          case 'DevicesNotFoundError':
            setHasCamera(false)
            break
          default:
            setHasCamera(false)
        }
      } else {
        setHasCamera(false)
      }
      
      onError(error as Error)
      setIsLoading(false)
    }
  }

  const handleRetry = async () => {
    log('Retrying initialization...')
    setInitializationAttempts(prev => prev + 1)
    setIsLoading(true)
    setHasCamera(true)
    setPermissionDenied(false)
    await initScanner()
  }

  // Initial setup
  useEffect(() => {
    log('Component mounted')
    mountedRef.current = true

    // Only initialize if we're supposed to be scanning
    if (isScanning) {
      initScanner()
    }

    return () => {
      log('Component unmounting')
      mountedRef.current = false
      Quagga.stop()
      stopStream()
    }
  }, [isScanning, initializationAttempts])

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio("data:audio/wav;base64,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qJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=")
    audioRef.current.preload = 'auto'

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  return (
    <div className="relative w-full h-full bg-black">
      {!hasCamera || permissionDenied ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 p-4">
          <div className="text-center space-y-4">
            <CameraOff className="h-8 w-8 mx-auto text-muted-foreground" />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {permissionDenied 
                  ? "Camera access was denied. Please grant permission to use your camera."
                  : "No camera found or camera access is not supported in this browser."}
              </p>
              <div className="flex flex-col gap-2 items-center">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRetry}
                  className="gap-2"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div
            ref={scannerRef}
            className="absolute inset-0 flex items-center justify-center"
            style={{
              overflow: 'hidden',
            }}
          >
            <video
              className="absolute min-w-full min-h-full object-cover"
              style={{
                transform: 'scaleX(-1)', // Mirror the video
              }}
            />
          </div>
          {isScanning && showGuides && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Scanning guides */}
              <div className="absolute inset-[10%] h-[80%] border-2 border-primary/30 rounded-lg">
                {/* Corner markers */}
                <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-primary" />
                <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-primary" />
                <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-primary" />
                <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-primary" />
                {/* Scanning line */}
                <div className="animate-scan" />
              </div>
              
              {/* Scanning indicator */}
              {showStatus && (
                <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center">
                  <div className="bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-full flex items-center gap-2">
                    <Camera className="h-4 w-4 animate-pulse" />
                    <span className="text-sm">
                      {isLoading ? "Initializing camera..." : "Scanning..."}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
} 