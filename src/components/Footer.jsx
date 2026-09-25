import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sprout, Mail, Phone, MapPin, Share2, Briefcase, Camera, GitBranch, ArrowUpRight, Leaf } from 'lucide-react'
import GrassStrip from './GrassStrip'

const footerLinks = {
  Platform: [
    { label: 'For Farmers', to: '/seller' },
    { label: 'For Buyers',  to: '/buyer' },
    { label: 'Market Prices', to: '/#markets' },
    { label: 'How It Works', to: '/#how' },
  ],
  Company: [
    { label: 'About Us', to: '/#about' },
    { label: 'Press',    to: '#' },
    { label: 'Blog',     to: '#' },
  ],
  Support: [
    { label: 'Help Center',     to: '#' },
    { label: 'Login Portal',    to: '/login' },
    { label: 'Privacy Policy',  to: '#' },
    { label: 'Terms of Service', to: '#' },
  ],
}

const socials = [
  { Icon: Share2,    href: '#', label: 'Twitter' },
  { Icon: Briefcase, href: '#', label: 'LinkedIn' },
  { Icon: Camera,    href: '#', label: 'Instagram' },
  { Icon: GitBranch, href: '#', label: 'GitHub' },
]

export default function Footer() {
  return (
    <footer className="relative bg-green-950 overflow-hidden">

      {/* Animated grass topper */}
      <div className="relative h-20 overflow-hidden">
        <GrassStrip density={110} heightMin={22} heightMax={75} />
      </div>

      {/* Subtle glow blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/4  w-96 h-64 rounded-full bg-green-800/20 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-48 rounded-full bg-lime-700/10  blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 pt-14 pb-8">

        {/* Newsletter strip */}
        <div className="bg-green-800/50 border border-green-700/40 rounded-3xl p-8 mb-14
                        flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="font-display font-bold text-2xl text-white mb-1">
              Stay Updated with Market Prices
            </h3>
            <p className="text-green-300 text-sm">
              Get real-time crop prices, buyer alerts and market intelligence in your inbox.
            </p>
          </div>
          <div className="flex gap-3 w-full md:w-auto shrink-0">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 md:w-64 px-5 py-3 rounded-full bg-green-900/60 border border-green-700/50
                         text-green-100 placeholder-green-600 text-sm
                         focus:outline-none focus:border-green-400 transition-all"
            />
            <button className="btn-primary text-sm px-6 py-3 shrink-0">Subscribe</button>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">

          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-5 w-fit group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600
                              flex items-center justify-center shadow-lg">
                <Sprout className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="font-display font-bold text-2xl text-green-300">AgriBridge</span>
                <p className="text-green-600 text-xs">Farm · Market · Connect</p>
              </div>
            </Link>

            <p className="text-green-400/80 text-sm leading-relaxed max-w-sm mb-6">
              Empowering India's 140 million farming families with direct market access,
              real-time price intelligence, and verified buyer connections — eliminating
              the middleman and maximising farmer profits.
            </p>

            <div className="space-y-2 mb-6">
              {[
                { Icon: Mail,  text: 'support@agribridge.in' },
                { Icon: Phone, text: '+91 1800 XXX XXXX (Toll Free)' },
                { Icon: MapPin,text: 'New Delhi, India 110001' },
              ].map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm text-green-500">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              {socials.map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 rounded-xl bg-green-800/60 border border-green-700/40
                             flex items-center justify-center text-green-400
                             hover:text-green-200 hover:bg-green-700/60
                             transition-all duration-300 hover:-translate-y-1"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-semibold text-green-200 mb-5 font-display">{title}</h4>
              <ul className="space-y-3">
                {links.map(({ label, to }) => (
                  <li key={label}>
                    <Link
                      to={to}
                      className="text-sm text-green-500 hover:text-green-300 transition-colors
                                 flex items-center gap-1 group"
                    >
                      {label}
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-green-800/40 pt-8
                        flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Leaf className="w-4 h-4 text-green-500" />
            <span>© 2026 AgriBridge. Made with 💚 for India's Farmers.</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-green-700">
            <span>SIH26132 — Smart India Hackathon</span>
            <span>·</span>
            <span>All rights reserved</span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Platform Live
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
