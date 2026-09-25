import React, { useState, useRef, useEffect } from 'react'
import { Globe, ChevronDown, Check } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

export default function LanguageSelector({ variant = 'dark' }) {
  const { language, setLanguage, languages } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentLang = languages.find(l => l.code === language) || languages[0]

  const isLight = variant === 'light'

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all shadow-sm ${
          isLight
            ? 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            : 'bg-emerald-950/80 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-900/80 hover:border-emerald-400'
        }`}
      >
        <Globe className="w-3.5 h-3.5 text-emerald-400" />
        <span>{currentLang.native}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 mt-2 w-44 rounded-2xl shadow-xl border p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 ${
            isLight
              ? 'bg-white border-gray-200 text-gray-800'
              : 'bg-slate-900/95 backdrop-blur-md border-emerald-500/30 text-white'
          }`}
        >
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400/80 border-b border-white/10 mb-1">
            Select Language / ভাষা / भाषा
          </div>
          {languages.map(l => {
            const isSelected = l.code === language
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLanguage(l.code)
                  setIsOpen(false)
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : isLight
                    ? 'hover:bg-gray-100 text-gray-700'
                    : 'hover:bg-white/10 text-gray-200'
                }`}
              >
                <div className="flex flex-col text-left">
                  <span className="font-semibold">{l.native}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-slate-900' : 'text-gray-400'}`}>
                    {l.label}
                  </span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
