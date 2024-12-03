"use client"

import { useEffect, useRef, useState } from "react"
import Quagga from '@ericblade/quagga2'
import { Camera, CameraOff, RefreshCcw } from "lucide-react"
import { Button } from "./ui/button"

const log = (message: string, data?: any) => {
  console.log(`[CameraScanner] ${message}`, data || '')
}

type QuaggaReader = "ean_reader" | "ean_8_reader" | "code_128_reader" | "code_39_reader" | "upc_reader" | "upc_e_reader"

interface CameraScannerProps {
  isScanning: boolean
  onScan: (barcode: string) => void
  onError: (error: Error) => void
  showGuides?: boolean
  showStatus?: boolean
  readers?: QuaggaReader[]
}

export function CameraScanner({ 
  isScanning, 
  onScan, 
  onError,
  showGuides = true,
  showStatus = true,
  readers = [
    "ean_reader",
    "ean_8_reader",
    "code_128_reader",
    "code_39_reader",
    "upc_reader",
    "upc_e_reader",
  ],
}: CameraScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mountedRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const quaggaInitializedRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [hasCamera, setHasCamera] = useState(true)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [initializationAttempts, setInitializationAttempts] = useState(0)

  const stopScanner = async () => {
    log('Stopping scanner...')
    if (quaggaInitializedRef.current) {
      try {
        await Quagga.stop()
        quaggaInitializedRef.current = false
      } catch (error) {
        log('Error stopping Quagga:', error)
      }
    }
    
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => {
          track.stop()
        })
        streamRef.current = null
      } catch (error) {
        log('Error stopping stream:', error)
      }
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current = null
    }
  }

  const initScanner = async () => {
    log('Initializing scanner...')
    if (!scannerRef.current || !isScanning) {
      log('Scanner ref not ready or scanning disabled')
      return
    }

    try {
      // Clean up any existing scanner/stream first
      await stopScanner()

      // Create video element
      const video = document.createElement('video')
      video.setAttribute('playsinline', 'true')
      videoRef.current = video

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
      video.srcObject = stream

      // Wait for video to be ready
      await new Promise((resolve) => {
        video.onloadedmetadata = () => resolve(true)
      })

      // Initialize Quagga
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
              readers,
              debug: {
                drawBoundingBox: showGuides,
                showPattern: showGuides,
                drawScanline: showGuides,
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
      quaggaInitializedRef.current = true
      await Quagga.start()
      log('Scanner started')
      setIsLoading(false)
      setHasCamera(true)
      setPermissionDenied(false)

      // Set up detection handler
      Quagga.onDetected((result) => {
        if (!result?.codeResult?.code) return
        onScan(result.codeResult.code)
      })

      if (showGuides) {
        // Set up image processing handlers for visual guides
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
      }

    } catch (error) {
      log('Error in initScanner:', error)
      await stopScanner()
      
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

    return () => {
      log('Component unmounting')
      mountedRef.current = false
      stopScanner()
    }
  }, [])

  // Handle scanning state changes
  useEffect(() => {
    if (!mountedRef.current) return

    const setupScanner = async () => {
      if (isScanning) {
        log('Scanning state changed to true, initializing scanner')
        setIsLoading(true)
        await initScanner()
      } else {
        log('Scanning state changed to false, stopping scanner')
        await stopScanner()
      }
    }

    setupScanner()
  }, [isScanning, readers]) // Add readers to dependencies

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio("data:audio/wav;base64,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qJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=")
    audioRef.current.preload = 'auto'

    return () => {
      if (audioRef.current) {
        audioRef.current = null
      }
    }
  }, [])

  return (
    <div className="relative w-full h-full" ref={scannerRef}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white">Initializing camera...</div>
        </div>
      )}

      {!hasCamera && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-center text-white space-y-4">
            <CameraOff className="h-12 w-12 mx-auto" />
            <p>No camera found</p>
            <Button onClick={handleRetry}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {permissionDenied && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-center text-white space-y-4">
            <Camera className="h-12 w-12 mx-auto" />
            <p>Camera permission denied</p>
            <Button onClick={handleRetry}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Request Permission
            </Button>
          </div>
        </div>
      )}
    </div>
  )
} 