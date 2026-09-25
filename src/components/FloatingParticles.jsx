import React from 'react'

export default function FloatingParticles({ count = 20, className = '' }) {
  const particles = React.useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top:  Math.random() * 100,
      size: 3 + Math.random() * 7,
      duration: 7 + Math.random() * 8,
      delay:    Math.random() * 6,
      opacity:  0.08 + Math.random() * 0.18,   // much more subtle on white
      color: ['#bbf7d0','#86efac','#4ade80','#a3e635','#d9f99d','#dcfce7'][
        Math.floor(Math.random() * 6)
      ],
    })),
  [count])

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {particles.map(p => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.left}%`,
            top:  `${p.top}%`,
            width:  `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            '--p-duration': `${p.duration}s`,
            '--p-delay':    `${p.delay}s`,
            opacity: p.opacity,
          }}
        />
      ))}
    </div>
  )
}
