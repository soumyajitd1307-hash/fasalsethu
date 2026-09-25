import React from 'react'

/* Individual grass blade */
const Blade = ({ x, height, color, delay, duration, leanL, leanR, width = 3 }) => (
  <div
    className="absolute bottom-0 grass-blade"
    style={{
      left: `${x}%`,
      width: `${width}px`,
      height: `${height}px`,
      background: `linear-gradient(to top, ${color[0]}, ${color[1]})`,
      borderRadius: '50% 50% 0 0 / 28% 28% 0 0',
      '--duration':   `${duration}s`,
      '--delay':      `${delay}s`,
      '--lean-left':  `${leanL}deg`,
      '--lean-right': `${leanR}deg`,
      transformOrigin: 'bottom center',
    }}
  />
)

/* Dense grass strip — brighter palette for white/light bg */
const GrassStrip = ({ density = 80, heightMin = 30, heightMax = 90, className = '' }) => {
  const blades = React.useMemo(() => {
    /* Brighter, more saturated greens that look great on white */
    const colors = [
      ['#166534', '#15803d'],
      ['#15803d', '#16a34a'],
      ['#16a34a', '#22c55e'],
      ['#22c55e', '#4ade80'],
      ['#4ade80', '#86efac'],
      ['#15803d', '#84cc16'],
      ['#16a34a', '#a3e635'],
      ['#0f5f2e', '#22c55e'],
    ]
    return Array.from({ length: density }, (_, i) => ({
      id: i,
      x:        (i / density) * 100 + (Math.random() - 0.5) * (100 / density),
      height:   heightMin + Math.random() * (heightMax - heightMin),
      color:    colors[Math.floor(Math.random() * colors.length)],
      delay:    Math.random() * 3,
      duration: 2.2 + Math.random() * 3.8,
      leanL:    -(2.5 + Math.random() * 5.5),
      leanR:    2.5  + Math.random() * 5.5,
      width:    2    + Math.random() * 2.8,
    }))
  }, [density, heightMin, heightMax])

  return (
    <div className={`absolute bottom-0 left-0 right-0 overflow-hidden grass-field ${className}`}>
      {blades.map(b => <Blade key={b.id} {...b} />)}
    </div>
  )
}

export default GrassStrip
