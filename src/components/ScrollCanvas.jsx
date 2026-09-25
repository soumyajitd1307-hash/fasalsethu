/**
 * ScrollCanvas — Full-page fixed background canvas animation
 *
 * Renders a canvas fixed to the viewport that plays through `frameCount` JPEG
 * frames as the user scrolls the entire page (0 → page bottom = frame 0 → last).
 *
 * Children are rendered in a normal document-flow wrapper on top of the canvas.
 * Sections should use translucent / glassmorphism backgrounds so the canvas
 * shows through behind the content.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react'

const BASE_PATH = `${import.meta.env.BASE_URL}frames/`

function padNum(n) {
  return String(n).padStart(3, '0')
}

function getFramePath(index) {
  return `${BASE_PATH}ezgif-frame-${padNum(index + 1)}.jpg`
}

export default function ScrollCanvas({
  frameCount = 300,
  children,
}) {
  const canvasRef   = useRef(null)
  const imagesRef   = useRef([])
  const loadedRef   = useRef(new Set())
  const frameIdxRef = useRef(0)
  const rafRef      = useRef(null)
  const [ready, setReady] = useState(false)

  /* ─── Draw a frame onto the canvas (cover-fit) ─── */
  const drawFrame = useCallback((idx) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const img = imagesRef.current[idx]
    if (!img || !loadedRef.current.has(idx)) return

    const ctx = canvas.getContext('2d')
    const cw = canvas.width
    const ch = canvas.height
    const iw = img.naturalWidth  || img.width
    const ih = img.naturalHeight || img.height
    const scale = Math.max(cw / iw, ch / ih)
    const sw = iw * scale
    const sh = ih * scale
    const sx = (cw - sw) / 2
    const sy = (ch - sh) / 2

    ctx.clearRect(0, 0, cw, ch)
    ctx.drawImage(img, sx, sy, sw, sh)
  }, [])

  /* ─── Resize canvas to full viewport ─── */
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width  = window.innerWidth  * dpr
    canvas.height = window.innerHeight * dpr
    canvas.style.width  = '100vw'
    canvas.style.height = '100vh'
    drawFrame(frameIdxRef.current)
  }, [drawFrame])

  /* ─── Map total page scroll → frame index ─── */
  const handleScroll = useCallback(() => {
    const scrollTop = window.scrollY
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    const progress  = maxScroll > 0 ? Math.min(1, Math.max(0, scrollTop / maxScroll)) : 0
    const idx       = Math.min(frameCount - 1, Math.floor(progress * (frameCount - 1)))

    if (idx !== frameIdxRef.current) {
      frameIdxRef.current = idx
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => drawFrame(idx))
    }
  }, [frameCount, drawFrame])

  /* ─── Progressive image preloading ─── */
  useEffect(() => {
    imagesRef.current = new Array(frameCount)

    function loadImage(idx) {
      return new Promise((resolve) => {
        const img = new Image()
        img.src = getFramePath(idx)
        img.onload = () => {
          imagesRef.current[idx] = img
          loadedRef.current.add(idx)
          resolve(idx)
        }
        img.onerror = () => resolve(idx)
      })
    }

    // 1. Frame 0 immediately
    loadImage(0).then(() => {
      resizeCanvas()
      drawFrame(0)
      setReady(true)
    })

    // 2. First 30 frames (critical for early scroll)
    const earlyBatch = []
    for (let i = 1; i < Math.min(30, frameCount); i++) earlyBatch.push(loadImage(i))
    Promise.all(earlyBatch).then(() => {
      // 3. Rest in batches of 15
      function loadBatch(start) {
        if (start >= frameCount) return
        const batch = []
        for (let i = start; i < Math.min(start + 15, frameCount); i++) {
          batch.push(loadImage(i))
        }
        Promise.all(batch).then(() => {
          drawFrame(frameIdxRef.current)
          loadBatch(start + 15)
        })
      }
      loadBatch(30)
    })
  }, [frameCount, resizeCanvas, drawFrame])

  /* ─── Event listeners ─── */
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', resizeCanvas)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', resizeCanvas)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [handleScroll, resizeCanvas])

  return (
    <>
      {/* Fixed canvas — sits behind everything in the page, always covers full viewport */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          display: 'block',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Loading skeleton */}
      {!ready && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #052e16, #064e3b)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, color: 'rgba(255,255,255,0.6)' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              border: '4px solid rgba(255,255,255,0.15)',
              borderTopColor: '#4ade80',
              animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: 2 }}>LOADING</span>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* Page content — stacks on top of the fixed canvas */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {children}
      </div>
    </>
  )
}
