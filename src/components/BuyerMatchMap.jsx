/**
 * BuyerMatchMap.jsx
 * ──────────────────────────────────────────────────────────────────
 * Interactive Google Map that renders buyer location markers.
 * Shows an info-card when the farmer clicks a buyer marker.
 *
 * Props:
 *   buyers   - Array of buyer objects with location.latitude/longitude
 *   center   - { lat, lng, name } — the farmer's search location
 *   radiusKm - The radius used for the search (shown on the map)
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, X, Phone, Mail, Package, Building2,
  ChevronRight, ShieldCheck, Wheat
} from 'lucide-react'
import { useGoogleMaps } from '../hooks/useGoogleMaps'

// Reuse the same dark emerald map style from GoogleMapBuyerRadar
const EMERALD_DARK_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#091811' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#091811' }, { weight: 3 }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#86efac' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#4ade80' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#22c55e' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#064e3b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#133a23' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#052e16' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#bbf7d0' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#16a34a' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#15803d' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#fef08a' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#142f1f' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#06283d' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#38bdf8' }] },
]

function BuyerInfoCard({ buyer, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.22 }}
      className="absolute top-4 right-4 z-30 w-72 bg-white border border-green-200 rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-emerald-600 px-4 py-3 flex items-start justify-between">
        <div>
          <p className="text-green-100 text-[10px] font-bold uppercase tracking-widest mb-0.5">
            Registered Buyer
          </p>
          <h3 className="text-white font-display font-bold text-sm leading-tight">
            {buyer.companyName || buyer.name}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-green-200 hover:text-white ml-2 mt-0.5 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <Building2 className="w-3.5 h-3.5 text-green-700" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase">Contact Person</p>
            <p className="text-gray-800 font-semibold text-xs">{buyer.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <Wheat className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase">Crops Required</p>
            <p className="text-gray-800 font-semibold text-xs">
              {buyer.cropsRequired?.join(', ') || '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <Package className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase">Required Quantity</p>
            <p className="text-gray-800 font-semibold text-xs">
              {buyer.requiredQuantity} {buyer.unit}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
            <MapPin className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase">Buyer Location</p>
            <p className="text-gray-800 font-semibold text-xs leading-tight">
              {buyer.location?.address}
            </p>
            {buyer.distanceKm !== undefined && (
              <span className="text-[10px] text-green-600 font-bold">
                ~{buyer.distanceKm} km from your search
              </span>
            )}
          </div>
        </div>

        {/* Contact buttons */}
        <div className="flex gap-2 pt-1">
          {buyer.phone && (
            <a
              href={`tel:${buyer.phone}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                         bg-green-600 hover:bg-green-700 text-white text-xs font-semibold
                         transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              Call
            </a>
          )}
          {buyer.email && (
            <a
              href={`mailto:${buyer.email}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                         bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold
                         transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              Email
            </a>
          )}
        </div>

        <div className="flex items-center gap-1 text-[10px] text-gray-400 pt-0.5">
          <ShieldCheck className="w-3 h-3 text-green-500" />
          Registered business location • Not live GPS
        </div>
      </div>
    </motion.div>
  )
}

export default function BuyerMatchMap({ buyers = [], center, radiusKm = 100 }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const centerMarkerRef = useRef(null)
  const circleRef = useRef(null)

  const { isLoaded, loadError } = useGoogleMaps()
  const [selectedBuyer, setSelectedBuyer] = useState(null)

  // Create / recreate map when Google Maps loads
  const initMap = useCallback(() => {
    if (!mapRef.current || !window.google?.maps) return

    const centerLatLng = {
      lat: center?.lat || 20.2,
      lng: center?.lng || 73.83,
    }

    const map = new window.google.maps.Map(mapRef.current, {
      center: centerLatLng,
      zoom: buyers.length === 0 ? 8 : 9,
      styles: EMERALD_DARK_STYLES,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    })
    mapInstanceRef.current = map

    // Center pin (farmer's search location)
    if (center) {
      centerMarkerRef.current = new window.google.maps.Marker({
        position: centerLatLng,
        map,
        title: `Search: ${center.name || 'Your Location'}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#22c55e',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        zIndex: 10,
      })

      // Radius circle
      circleRef.current = new window.google.maps.Circle({
        map,
        center: centerLatLng,
        radius: radiusKm * 1000, // metres
        fillColor: '#22c55e',
        fillOpacity: 0.06,
        strokeColor: '#4ade80',
        strokeOpacity: 0.5,
        strokeWeight: 1.5,
      })
    }
  }, [center, buyers.length, radiusKm])

  // Place buyer markers
  const placeMarkers = useCallback(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    if (buyers.length === 0) return

    const bounds = new window.google.maps.LatLngBounds()
    if (center) bounds.extend({ lat: center.lat, lng: center.lng })

    buyers.forEach((buyer) => {
      const pos = {
        lat: buyer.location.latitude,
        lng: buyer.location.longitude,
      }

      const marker = new window.google.maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        title: buyer.companyName || buyer.name,
        icon: {
          path: window.google.maps.SymbolPath.MAP_PIN,
          scale: 9,
          fillColor: '#f59e0b',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        animation: window.google.maps.Animation.DROP,
      })

      marker.addListener('click', () => {
        setSelectedBuyer(buyer)
      })

      markersRef.current.push(marker)
      bounds.extend(pos)
    })

    // Fit map to all buyers + center
    if (!bounds.isEmpty()) {
      mapInstanceRef.current.fitBounds(bounds, { top: 60, right: 40, bottom: 40, left: 40 })
    }
  }, [buyers, center])

  // Init map once Google Maps script is loaded
  useEffect(() => {
    if (isLoaded) {
      initMap()
    }
  }, [isLoaded, initMap])

  // Update markers when buyers list changes
  useEffect(() => {
    if (isLoaded && mapInstanceRef.current) {
      placeMarkers()
    }
  }, [isLoaded, buyers, placeMarkers])

  // ── Render states ────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="h-80 flex items-center justify-center rounded-3xl bg-gray-100 border border-gray-200">
        <div className="text-center">
          <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Map could not load. Check your API key.</p>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="h-80 flex items-center justify-center rounded-3xl bg-gray-900 border border-green-900/30">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-green-500/30 border-t-green-500 animate-spin mx-auto mb-3" />
          <p className="text-green-400 text-sm font-medium">Loading Map…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative rounded-3xl overflow-hidden border border-green-900/40 shadow-2xl">
      {/* Map container */}
      <div ref={mapRef} className="w-full h-[420px] sm:h-[500px]" />

      {/* Legend / status bar */}
      <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full">
          <span className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
          <span className="text-green-300 text-[11px] font-semibold">
            {center?.name || 'Search Location'}
          </span>
        </div>
        {buyers.length > 0 && (
          <div className="flex items-center gap-2 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
            <span className="text-amber-300 text-[11px] font-semibold">
              {buyers.length} Buyer{buyers.length !== 1 ? 's' : ''} Found
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full">
          <ChevronRight className="w-3 h-3 text-green-400" />
          <span className="text-green-300/80 text-[11px]">
            Radius: {radiusKm} km
          </span>
        </div>
      </div>

      {/* Buyer info card (on marker click) */}
      <AnimatePresence>
        {selectedBuyer && (
          <BuyerInfoCard
            buyer={selectedBuyer}
            onClose={() => setSelectedBuyer(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
