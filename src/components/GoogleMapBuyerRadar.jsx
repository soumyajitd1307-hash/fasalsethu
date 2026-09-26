import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Navigation, Compass, ShieldCheck, Truck,
  Star, ChevronRight, Layers, Crosshair, AlertCircle, RefreshCw,
  ExternalLink
} from 'lucide-react'
import { useGoogleMaps } from '../hooks/useGoogleMaps'

// Custom Emerald Dark Map Style matching Fasal Sethu design system
const EMERALD_DARK_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#091811' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#091811' }, { weight: 3 }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#86efac' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4ade80' }, { weight: 1 }]
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#22c55e' }]
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#064e3b' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#133a23' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#052e16' }]
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#bbf7d0' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#16a34a' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#15803d' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#fef08a' }]
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#142f1f' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#06283d' }]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#06283d' }]
  }
]

export default function GoogleMapBuyerRadar({
  buyers = [],
  activeBuyerId = null,
  farmerCoords = { lat: 20.20, lng: 73.83 },
  farmerLocationText = 'Dindori, Nashik',
  currentRadius = 50,
  onSelectBuyer,
  onConnectBuyer,
  onSwitchToRadar,
}) {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const farmMarkerRef = useRef(null)
  const circleRef = useRef(null)
  const polylineRef = useRef(null)
  const infoWindowRef = useRef(null)

  const [mapTheme, setMapTheme] = useState('EMERALD') // 'EMERALD' | 'HYBRID' | 'ROADMAP'
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState(null)
  const [liveFarmerCoords, setLiveFarmerCoords] = useState(farmerCoords)

  const { isLoaded, loadError } = useGoogleMaps()

  // Calculate safe GPS coordinates for buyers lacking explicit lat/lng
  const getBuyerCoords = useCallback((b, idx) => {
    if (b.latitude && b.longitude) {
      return { lat: Number(b.latitude), lng: Number(b.longitude) }
    }
    const dist = b.distance !== undefined ? b.distance : b.distanceKm || 20
    const angle = (idx * 72 + 35) * (Math.PI / 180)
    const latOffset = (dist / 111) * Math.sin(angle)
    const lngOffset = (dist / (111 * Math.cos(liveFarmerCoords.lat * (Math.PI / 180)))) * Math.cos(angle)
    return {
      lat: liveFarmerCoords.lat + latOffset,
      lng: liveFarmerCoords.lng + lngOffset,
    }
  }, [liveFarmerCoords])

  // Filter buyers within radius
  const filteredBuyers = buyers.filter(b => {
    const dist = b.distance !== undefined ? b.distance : b.distanceKm
    return dist <= currentRadius
  })

  // ── 1. Initialize Map ──
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || !window.google?.maps) return
    // Guard: MapTypeId must be available before creating map
    if (!window.google.maps.MapTypeId) return

    if (!mapRef.current) {
      const mapOptions = {
        center: liveFarmerCoords,
        zoom: currentRadius <= 25 ? 11 : currentRadius <= 50 ? 10 : 9,
        mapTypeId: mapTheme === 'HYBRID'
          ? window.google.maps.MapTypeId.HYBRID
          : window.google.maps.MapTypeId.ROADMAP,
        styles: mapTheme === 'EMERALD' ? EMERALD_DARK_STYLES : null,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
      }

      mapRef.current = new window.google.maps.Map(mapContainerRef.current, mapOptions)
      infoWindowRef.current = new window.google.maps.InfoWindow()
    }
  }, [isLoaded, liveFarmerCoords, currentRadius, mapTheme])


  // ── 2. Update Map Style when theme changes ──
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return

    if (mapTheme === 'HYBRID') {
      mapRef.current.setMapTypeId(window.google.maps.MapTypeId.HYBRID)
      mapRef.current.setOptions({ styles: null })
    } else if (mapTheme === 'ROADMAP') {
      mapRef.current.setMapTypeId(window.google.maps.MapTypeId.ROADMAP)
      mapRef.current.setOptions({ styles: null })
    } else {
      mapRef.current.setMapTypeId(window.google.maps.MapTypeId.ROADMAP)
      mapRef.current.setOptions({ styles: EMERALD_DARK_STYLES })
    }
  }, [mapTheme])

  // ── Sync with external farmerCoords prop updates (manual search) ──
  useEffect(() => {
    if (farmerCoords && typeof farmerCoords.lat === 'number' && typeof farmerCoords.lng === 'number') {
      setLiveFarmerCoords(farmerCoords)
      if (mapRef.current) {
        mapRef.current.panTo(farmerCoords)
        mapRef.current.setZoom(currentRadius <= 25 ? 11 : currentRadius <= 50 ? 10 : 9)
      }
    }
  }, [farmerCoords, currentRadius])

  // ── 3. Render Farm Hub Marker & Radius Circle ──
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return

    // Farm Hub Marker
    if (!farmMarkerRef.current) {
      farmMarkerRef.current = new window.google.maps.Marker({
        position: liveFarmerCoords,
        map: mapRef.current,
        title: `Your Farm Hub (${farmerLocationText})`,
        zIndex: 999,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52" fill="none">
              <circle cx="22" cy="22" r="20" fill="#10b981" stroke="#ffffff" stroke-width="3" filter="drop-shadow(0 4px 10px rgba(16,185,129,0.5))"/>
              <path d="M14 22L22 14L30 22V29C30 29.5523 29.5523 30 29 30H15C14.4477 30 14 29.5523 14 29V22Z" fill="white"/>
              <path d="M20 30V24H24V30H20Z" fill="#047857"/>
              <polygon points="22,48 16,36 28,36" fill="#10b981"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(44, 52),
          anchor: new window.google.maps.Point(22, 50),
        },
      })
    } else {
      farmMarkerRef.current.setPosition(liveFarmerCoords)
      farmMarkerRef.current.setTitle(`Your Farm Hub (${farmerLocationText})`)
    }

    // Always update click listener with latest location data
    window.google.maps.event.clearListeners(farmMarkerRef.current, 'click')
    farmMarkerRef.current.addListener('click', () => {
      if (!infoWindowRef.current) return
      infoWindowRef.current.setContent(`
        <div style="font-family: system-ui, sans-serif; padding: 6px; max-width: 220px; color: #111827;">
          <div style="font-weight: 800; font-size: 13px; color: #047857; margin-bottom: 2px;">🏡 Your Farm Hub</div>
          <div style="font-size: 11px; color: #374151; margin-bottom: 4px;">${farmerLocationText}</div>
          <div style="font-size: 10px; color: #6b7280; font-family: monospace;">GPS: ${liveFarmerCoords.lat.toFixed(3)}° N, ${liveFarmerCoords.lng.toFixed(3)}° E</div>
          <div style="margin-top: 6px; font-size: 10px; background: #ecfdf5; color: #065f46; padding: 2px 6px; border-radius: 4px; display: inline-block; font-weight: 600;">
            Radius: ${currentRadius} km Active
          </div>
        </div>
      `)
      infoWindowRef.current.open(mapRef.current, farmMarkerRef.current)
    })

    // Geodesic Radius Circle
    if (!circleRef.current) {
      circleRef.current = new window.google.maps.Circle({
        strokeColor: '#10b981',
        strokeOpacity: 0.8,
        strokeWeight: 1.5,
        fillColor: '#10b981',
        fillOpacity: 0.12,
        map: mapRef.current,
        center: liveFarmerCoords,
        radius: currentRadius * 1000,
      })
    } else {
      circleRef.current.setCenter(liveFarmerCoords)
      circleRef.current.setRadius(currentRadius * 1000)
    }

    // Auto-fit bounds smoothly to show full circle
    const bounds = circleRef.current.getBounds()
    if (bounds) {
      mapRef.current.fitBounds(bounds, 40)
    }
  }, [isLoaded, liveFarmerCoords, currentRadius, farmerLocationText])

  // ── 4. Render Buyer Markers ──
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    filteredBuyers.forEach((b, idx) => {
      const coords = getBuyerCoords(b, idx)
      const isSelected = b.id === activeBuyerId
      const providesFreePickup = b.freightStatus !== undefined ? b.freightStatus : b.transportProvided
      const dist = b.distance !== undefined ? b.distance : b.distanceKm

      const pinColor = isSelected ? '#f59e0b' : providesFreePickup ? '#10b981' : '#0284c7'
      const pinStroke = isSelected ? '#ffffff' : '#ffffff'

      const marker = new window.google.maps.Marker({
        position: coords,
        map: mapRef.current,
        title: `${b.name} (${dist} km)`,
        zIndex: isSelected ? 500 : 100 + idx,
        animation: isSelected ? window.google.maps.Animation.BOUNCE : null,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="38" height="46" viewBox="0 0 38 46" fill="none">
              <circle cx="19" cy="19" r="16" fill="${pinColor}" stroke="${pinStroke}" stroke-width="2.5" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.3))"/>
              <text x="19" y="24" font-size="14" text-anchor="middle" fill="#ffffff">🏢</text>
              <polygon points="19,42 13,32 25,32" fill="${pinColor}"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(38, 46),
          anchor: new window.google.maps.Point(19, 44),
        },
      })

      marker.addListener('click', () => {
        if (onSelectBuyer) onSelectBuyer(b)

        if (!infoWindowRef.current) return
        const priceMap = b.offeredPrices || b.offeredPricePerQtl || {}
        const topCrop = (b.crops || b.interestedCrops || [])[0]
        const topPrice = topCrop ? priceMap[topCrop] : null

        infoWindowRef.current.setContent(`
          <div style="font-family: system-ui, sans-serif; padding: 6px 4px; min-width: 220px; color: #111827;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 10px; background: #dcfce7; color: #166534; font-weight: 700; padding: 1px 6px; border-radius: 99px;">
                ${b.type || 'Verified Buyer'}
              </span>
              <span style="font-size: 11px; font-weight: 700; color: #d97706;">★ ${b.trustScore || 95}% Trust</span>
            </div>
            <div style="font-weight: 800; font-size: 14px; color: #111827; margin-bottom: 2px;">
              ${b.name}
            </div>
            <div style="font-size: 11px; color: #6b7280; margin-bottom: 6px;">
              📍 ${b.location || 'Maharashtra'} · <strong style="color: #047857;">${dist} km away</strong>
            </div>
            ${
              topCrop
                ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px 8px; font-size: 11px; margin-bottom: 6px; display: flex; justify-content: space-between;">
                     <span style="color: #334155; font-weight: 600;">${topCrop}:</span>
                     <span style="color: #15803d; font-weight: 800;">₹${topPrice || 'Quote'}/qtl</span>
                   </div>`
                : ''
            }
            <div style="font-size: 10px; color: ${providesFreePickup ? '#059669' : '#0284c7'}; font-weight: 600; margin-bottom: 8px;">
              ${providesFreePickup ? '🚚 FREE Farmgate Pickup' : '📦 Farmer Delivery'}
            </div>
            <button
              id="btn-deal-${b.id}"
              style="width: 100%; padding: 6px 12px; background: #15803d; color: #ffffff; border: none; border-radius: 8px; font-weight: 700; font-size: 11px; cursor: pointer;"
            >
              🌾 Connect & Propose Deal →
            </button>
          </div>
        `)
        infoWindowRef.current.open(mapRef.current, marker)

        setTimeout(() => {
          const btn = document.getElementById(`btn-deal-${b.id}`)
          if (btn && onConnectBuyer) {
            btn.onclick = () => onConnectBuyer(b)
          }
        }, 100)
      })

      markersRef.current.push(marker)
    })
  }, [filteredBuyers, activeBuyerId, isLoaded, getBuyerCoords, onSelectBuyer, onConnectBuyer])

  // ── 5. Render Route Line to Selected Buyer ──
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return

    if (polylineRef.current) {
      polylineRef.current.setMap(null)
      polylineRef.current = null
    }

    if (!activeBuyerId) return
    const activeIndex = filteredBuyers.findIndex(b => b.id === activeBuyerId)
    const activeBuyer = filteredBuyers[activeIndex]
    if (!activeBuyer) return

    const buyerCoords = getBuyerCoords(activeBuyer, activeIndex)

    polylineRef.current = new window.google.maps.Polyline({
      path: [liveFarmerCoords, buyerCoords],
      geodesic: true,
      strokeColor: '#f59e0b',
      strokeOpacity: 0.9,
      strokeWeight: 3.5,
      map: mapRef.current,
    })
  }, [activeBuyerId, filteredBuyers, liveFarmerCoords, getBuyerCoords])

  // ── 6. Geolocation: Use Device GPS ──
  const handleUseDeviceLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser')
      return
    }
    setGpsLoading(true)
    setGpsError(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false)
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLiveFarmerCoords(coords)
        if (mapRef.current) {
          mapRef.current.panTo(coords)
          mapRef.current.setZoom(10)
        }
      },
      (err) => {
        setGpsLoading(false)
        setGpsError(err.message || 'Unable to retrieve your location')
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  // ── 7. Recenter Map on Farm ──
  const handleRecenter = () => {
    if (!mapRef.current) return
    mapRef.current.panTo(liveFarmerCoords)
    if (circleRef.current) {
      const bounds = circleRef.current.getBounds()
      if (bounds) mapRef.current.fitBounds(bounds, 40)
    }
  }

  // Fallback if loading error
  if (loadError) {
    return (
      <div className="relative w-full h-[460px] bg-slate-900 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-white">
        <AlertCircle className="w-10 h-10 text-amber-400 mb-3" />
        <h4 className="font-display font-bold text-lg mb-1">Live Google Maps Notice</h4>
        <p className="text-gray-300 text-xs max-w-md mb-4">
          Google Maps API could not connect directly (network restriction or API quota). You can switch to our high-precision Radar view.
        </p>
        <button
          type="button"
          onClick={onSwitchToRadar}
          className="px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg flex items-center gap-2 transition-all"
        >
          <Compass className="w-4 h-4" />
          Switch to Radar Sweep View
        </button>
      </div>
    )
  }

  return (
    <div className="relative w-full h-[460px] sm:h-[500px] overflow-hidden rounded-2xl bg-slate-950">
      {/* Loading Skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 z-30 bg-slate-900 flex flex-col items-center justify-center text-white gap-3">
          <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono text-emerald-400">Loading Live Google Maps Engine (Fasal Sethu)...</p>
        </div>
      )}

      {/* The Actual Google Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Top Left Toolbar: Map Theme Toggles */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/75 backdrop-blur-md p-1 rounded-xl border border-white/15 shadow-xl text-xs">
        <button
          type="button"
          onClick={() => setMapTheme('EMERALD')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
            mapTheme === 'EMERALD'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-300 hover:text-white hover:bg-white/10'
          }`}
          title="Fasal Sethu Emerald Dark Mode"
        >
          🌿 Emerald Night
        </button>
        <button
          type="button"
          onClick={() => setMapTheme('HYBRID')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
            mapTheme === 'HYBRID'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-300 hover:text-white hover:bg-white/10'
          }`}
          title="Satellite View"
        >
          🛰️ Satellite
        </button>
        <button
          type="button"
          onClick={() => setMapTheme('ROADMAP')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
            mapTheme === 'ROADMAP'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-300 hover:text-white hover:bg-white/10'
          }`}
          title="Clean Roadmap"
        >
          🗺️ Standard
        </button>
      </div>

      {/* Top Center Location Indicator */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 hidden md:flex items-center gap-2 bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-emerald-500/40 text-xs shadow-xl pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-gray-300">Map Centered:</span>
        <strong className="text-white font-medium truncate max-w-[180px]">{farmerLocationText}</strong>
        <span className="text-[10px] text-emerald-400 font-mono">
          ({liveFarmerCoords.lat.toFixed(2)}°, {liveFarmerCoords.lng.toFixed(2)}°)
        </span>
      </div>

      {/* Top Right Action: Recenter & GPS */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleRecenter}
          className="p-2 rounded-xl bg-black/75 hover:bg-black/90 text-white border border-white/15 backdrop-blur-md shadow-lg transition-all text-xs font-semibold flex items-center gap-1.5"
          title="Recenter on Farm Hub"
        >
          <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Recenter Farm</span>
        </button>

        <button
          type="button"
          onClick={handleUseDeviceLocation}
          disabled={gpsLoading}
          className="p-2 rounded-xl bg-black/75 hover:bg-black/90 text-white border border-white/15 backdrop-blur-md shadow-lg transition-all text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
          title="Locate my exact farm using GPS"
        >
          <Navigation className={`w-3.5 h-3.5 text-sky-400 ${gpsLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Live GPS</span>
        </button>
      </div>

      {/* GPS Error Toast */}
      {gpsError && (
        <div className="absolute top-16 left-3 z-20 bg-rose-900/90 text-white text-xs px-3 py-1.5 rounded-lg border border-rose-500/50 shadow-md">
          {gpsError}
        </div>
      )}

      {/* Bottom Floating Legend */}
      <div className="absolute bottom-3 left-3 z-20 flex flex-wrap gap-2.5 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 text-[10px] text-gray-200 shadow-xl">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-300/40" /> My Farm
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Free Pickup
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Farmer Delivery
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Selected Deal
        </span>
      </div>

      {/* Floating Active Range Pill */}
      <div className="absolute bottom-3 right-3 z-20 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 text-[11px] font-mono text-emerald-400 shadow-xl">
        📍 {filteredBuyers.length} Buyers within {currentRadius} km
      </div>
    </div>
  )
}
