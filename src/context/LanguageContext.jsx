import React, { createContext, useContext, useState, useEffect } from 'react'
import en from '../locales/en.json'
import bn from '../locales/bn.json'
import hi from '../locales/hi.json'

const translations = { en, bn, hi }

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'hi', label: 'Hindi', native: 'हिंदी' },
]

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem('fasalsethu_language')
      if (saved && translations[saved]) return saved
    } catch {
      // fallback
    }
    return 'en'
  })

  function setLanguage(code) {
    if (translations[code]) {
      setLanguageState(code)
      try {
        localStorage.setItem('fasalsethu_language', code)
      } catch {
        // ignore storage error
      }
    }
  }

  // Helper to translate nested keys, e.g., t('auth.loginButton')
  function t(keyPath, params = {}) {
    if (!keyPath) return ''
    const keys = keyPath.split('.')

    // Look up in selected language first
    let val = translations[language]
    for (const k of keys) {
      if (val && typeof val === 'object' && k in val) {
        val = val[k]
      } else {
        val = undefined
        break
      }
    }

    // Fallback to English if missing
    if (val === undefined) {
      val = translations.en
      for (const k of keys) {
        if (val && typeof val === 'object' && k in val) {
          val = val[k]
        } else {
          val = undefined
          break
        }
      }
    }

    // Fallback to key itself
    if (typeof val !== 'string') {
      return keyPath
    }

    // Replace {variable} placeholders
    let result = val
    Object.keys(params).forEach(p => {
      result = result.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p])
    })
    return result
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languages: SUPPORTED_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return ctx
}
