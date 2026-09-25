import React, { useRef, useEffect, useState } from 'react'

/**
 * WindHeroCanvas
 * Fullscreen WebGL living landscape shader with natural 3D wind physics:
 * - Fullscreen background coverage (true object-fit: cover on any viewport)
 * - Dominant left-to-right wind wave propagation across foreground vegetation
 * - Physics-based stem bending & lateral displacement with natural vertical dip
 * - High-frequency secondary flutter on flower heads (detects floral chroma)
 * - Dynamic procedural wind gusts surging periodically
 * - Damped mouse parallax with true depth stratification
 * - Zero overhead: pauses when offscreen or tab inactive; safe fallback if WebGL unavailable.
 */

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;

varying vec2 v_uv;

uniform sampler2D u_texture;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_imageAspect;
uniform vec2 u_mouse;
uniform float u_windIntensity;
uniform float u_gust;

// Procedural noise & FBM
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float val = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 4; i++) {
    val += amp * noise(p);
    p = rot * p * 2.05 + vec2(17.3, 42.1);
    amp *= 0.5;
  }
  return val;
}

// Robust object-fit: cover mapping
vec2 coverUv(vec2 uv, vec2 res, float imgAspect) {
  float screenAspect = res.x / res.y;
  vec2 s;
  if (screenAspect > imgAspect) {
    // Screen is wider than image: fit width, crop height
    s = vec2(1.0, imgAspect / screenAspect);
  } else {
    // Screen is taller than image: fit height, crop width
    s = vec2(screenAspect / imgAspect, 1.0);
  }
  return (uv - 0.5) * s + 0.5;
}

void main() {
  // Flip Y so 0.0 is top (sky/mountains) and 1.0 is bottom (flowers/grass)
  vec2 screenUv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 baseUv = coverUv(screenUv, u_resolution, u_imageAspect);

  // Clamp to valid texture boundaries
  baseUv = clamp(baseUv, vec2(0.001), vec2(0.999));

  // Depth Mask:
  // baseUv.y: 0.0 = sky, 0.50 = cabin/mountains, 0.55 - 1.0 = flower meadow
  // Top 50% (mountains, sky, cabin) has strictly 0 displacement
  float vegetationZone = smoothstep(0.48, 0.70, baseUv.y);
  float stemBendingFactor = pow(clamp((baseUv.y - 0.48) / 0.52, 0.0, 1.0), 1.4);
  float totalMask = vegetationZone * stemBendingFactor;

  // 1. Dominant Left-to-Right Wind Wave
  float windWave = sin(baseUv.x * 5.5 - u_time * 1.6) * 0.022;

  // 2. Multi-octave FBM turbulence (swirling natural wind eddies)
  float turbulence = (fbm(vec2(baseUv.x * 3.0 - u_time * 0.5, baseUv.y * 2.0)) - 0.5) * 0.028;

  // 3. High-frequency micro-breeze (fluttering tips)
  float microBreeze = sin(baseUv.x * 22.0 - u_time * 3.2 + baseUv.y * 12.0) * 0.008;

  // 4. Sample base color to detect flower heads (poppies, purple clovers)
  vec4 colorSample = texture2D(u_texture, baseUv);
  float isOrangePoppy = smoothstep(0.10, 0.35, colorSample.r - colorSample.b) * smoothstep(0.25, 0.65, colorSample.g);
  float isPurpleFlower = smoothstep(0.05, 0.25, colorSample.b - colorSample.g) * smoothstep(0.20, 0.60, colorSample.r);
  float flowerSecondary = sin(u_time * 4.2 + baseUv.x * 50.0) * 0.008 * (isOrangePoppy * 1.5 + isPurpleFlower * 1.2);

  // 5. Total lateral displacement (X)
  float dispX = (windWave + turbulence + microBreeze + flowerSecondary) * totalMask * u_windIntensity * (1.0 + u_gust);

  // 6. Natural stem compression: bending sideways causes tips to dip down (Y)
  float dispY = -abs(dispX) * 0.5 * totalMask;

  // 7. Subtle living camera breath (ambient motion across whole landscape)
  vec2 ambientDrift = vec2(sin(u_time * 0.45) * 0.0025, cos(u_time * 0.35) * 0.0018);

  // 8. Mouse Parallax with Depth Stratification
  float parallaxWeight = mix(0.003, 0.016, totalMask);
  vec2 parallax = u_mouse * parallaxWeight;

  // Final displaced UV
  vec2 finalUv = baseUv + vec2(-dispX, -dispY) + ambientDrift + parallax;
  finalUv = clamp(finalUv, vec2(0.001), vec2(0.999));

  // Subtle sunlight glint on bending grass blades
  vec4 finalColor = texture2D(u_texture, finalUv);
  float sunGlint = max(0.0, dispX) * 1.2 * totalMask;
  finalColor.rgb += vec3(0.05, 0.04, 0.02) * sunGlint;

  gl_FragColor = finalColor;
}
`

export default function WindHeroCanvas({
  imageSrc = '/hero-landscape.jpg',
  fallbackSrc = '/hero-reference.png',
  className = '',
}) {
  const canvasRef = useRef(null)
  const [webglSupported, setWebglSupported] = useState(true)
  const [imageLoaded, setImageLoaded] = useState(false)
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 })
  const isVisibleRef = useRef(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let gl = null
    try {
      gl = canvas.getContext('webgl', {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: true,
        powerPreference: 'high-performance',
      })
    } catch {
      gl = null
    }

    if (!gl) {
      setWebglSupported(false)
      return
    }

    function createShader(gl, type, source) {
      const shader = gl.createShader(type)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    if (!vs || !fs) {
      setWebglSupported(false)
      return
    }

    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program))
      setWebglSupported(false)
      return
    }
    gl.useProgram(program)

    // Full-screen quad
    const quadVertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ])
    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW)

    const posLoc = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    // Uniforms
    const uTime = gl.getUniformLocation(program, 'u_time')
    const uResolution = gl.getUniformLocation(program, 'u_resolution')
    const uImageAspect = gl.getUniformLocation(program, 'u_imageAspect')
    const uMouse = gl.getUniformLocation(program, 'u_mouse')
    const uWindIntensity = gl.getUniformLocation(program, 'u_windIntensity')
    const uGust = gl.getUniformLocation(program, 'u_gust')
    const uTexture = gl.getUniformLocation(program, 'u_texture')

    gl.uniform1i(uTexture, 0)

    // Load Texture
    const texture = gl.createTexture()
    let imgAspect = 4 / 3
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      imgAspect = img.width / img.height
      setImageLoaded(true)
    }

    img.onerror = () => {
      if (img.src !== fallbackSrc) {
        img.src = fallbackSrc
      } else {
        setWebglSupported(false)
      }
    }
    img.src = imageSrc

    // Resize
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = canvas.clientWidth * dpr
      const height = canvas.clientHeight * dpr
      if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)
      }
    }
    resize()
    window.addEventListener('resize', resize)

    // Mouse Tracking
    function onMouseMove(e) {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2
      const ny = (e.clientY / window.innerHeight - 0.5) * 2
      mouseRef.current.targetX = nx
      mouseRef.current.targetY = ny
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true })

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const observer = new IntersectionObserver(([entry]) => {
      isVisibleRef.current = entry.isIntersecting
    }, { threshold: 0.05 })
    observer.observe(canvas)

    let animId = null
    const startTime = performance.now()

    function render(currentTime) {
      animId = requestAnimationFrame(render)

      if (!isVisibleRef.current || document.hidden) return

      const elapsed = (currentTime - startTime) * 0.001

      // Mouse smoothing
      const m = mouseRef.current
      m.x += (m.targetX - m.x) * 0.05
      m.y += (m.targetY - m.y) * 0.05

      // Periodic natural gusts surging every 4-6 seconds
      const gustCycle = Math.sin(elapsed * 0.32) * Math.sin(elapsed * 0.78 + 1.2)
      const gust = Math.max(0, gustCycle) ** 2.0 * 2.0

      gl.useProgram(program)
      gl.uniform1f(uTime, reducedMotion ? 0.0 : elapsed)
      gl.uniform2f(uResolution, canvas.width, canvas.height)
      gl.uniform1f(uImageAspect, imgAspect)
      gl.uniform2f(uMouse, m.x, m.y)
      gl.uniform1f(uWindIntensity, reducedMotion ? 0.0 : 1.0)
      gl.uniform1f(uGust, reducedMotion ? 0.0 : gust)

      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }

    animId = requestAnimationFrame(render)

    return () => {
      if (animId) cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      observer.disconnect()
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(vbo)
      gl.deleteTexture(texture)
    }
  }, [imageSrc, fallbackSrc])

  if (!webglSupported) {
    return (
      <div className={`absolute inset-0 w-full h-full overflow-hidden pointer-events-none ${className}`}>
        <img
          src={imageSrc}
          alt="Hero Nature Landscape"
          className="w-full h-full object-cover select-none"
        />
      </div>
    )
  }

  return (
    <div className={`absolute inset-0 w-full h-full overflow-hidden pointer-events-none ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full block select-none"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      {!imageLoaded && (
        <img
          src={imageSrc}
          alt="Loading Landscape"
          className="absolute inset-0 w-full h-full object-cover select-none"
        />
      )}
    </div>
  )
}
