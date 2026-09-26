import { useState, useEffect } from 'react'

const DEFAULT_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBLtMKd5P4PcfBUQwAFnK_44G2CPZuL75E'

export function useGoogleMaps(apiKey = DEFAULT_API_KEY) {
  const [isLoaded, setIsLoaded] = useState(() => {
    return Boolean(typeof window !== 'undefined' && window.google && window.google.maps)
  })
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.google && window.google.maps) {
      setIsLoaded(true)
      return
    }

    const scriptId = 'google-maps-sdk-script'
    const existingScript = document.getElementById(scriptId)

    if (existingScript) {
      const handleLoad = () => setIsLoaded(true)
      const handleError = (e) => setLoadError(e)

      existingScript.addEventListener('load', handleLoad)
      existingScript.addEventListener('error', handleError)

      if (window.google && window.google.maps) {
        setIsLoaded(true)
      }

      return () => {
        existingScript.removeEventListener('load', handleLoad)
        existingScript.removeEventListener('error', handleError)
      }
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.type = 'text/javascript'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&loading=async`
    script.async = true
    script.defer = true

    script.onload = () => {
      setIsLoaded(true)
    }

    script.onerror = (err) => {
      console.warn('Failed to load Google Maps SDK:', err)
      setLoadError(new Error('Failed to load Google Maps SDK'))
    }

    document.head.appendChild(script)
  }, [apiKey])

  return { isLoaded, loadError }
}
