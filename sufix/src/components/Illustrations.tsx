// Vector product illustrations, used until the admin uploads real photos. Each one draws with the site's colors.
import React from 'react'
import type { IllustrationKey } from '@shared/types'

const P = 'var(--primary)', A = 'var(--accent)', D = 'var(--text-3)'
const body = 'url(#sfx-body)'

function Defs() {
  return (
    <defs>
      <linearGradient id="sfx-body" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#4b5563" />
        <stop offset=".5" stopColor="#1f2937" />
        <stop offset="1" stopColor="#0f172a" />
      </linearGradient>
      <linearGradient id="sfx-glass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e2e8f0" stopOpacity=".9" />
        <stop offset="1" stopColor="#64748b" stopOpacity=".6" />
      </linearGradient>
      <radialGradient id="sfx-glow" cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor={P} stopOpacity=".55" />
        <stop offset="1" stopColor={P} stopOpacity="0" />
      </radialGradient>
    </defs>
  )
}

const Drone = ({ variant = 'std' }: { variant?: 'std' | 'fpv' | 'pro' }) => (
  <>
    <ellipse cx="100" cy="150" rx="70" ry="10" fill="url(#sfx-glow)" />
    {/* arms */}
    <g stroke={body} strokeWidth="9" strokeLinecap="round">
      <line x1="80" y1="95" x2="40" y2="60" /><line x1="120" y1="95" x2="160" y2="60" /><line x1="80" y1="105" x2="40" y2="140" /><line x1="120" y1="105" x2="160" y2="140" />
    </g>
    {/* motors + props */}
    {[[40, 60], [160, 60], [40, 140], [160, 140]].map(([x, y], i) => (
      <g key={i}>
        <ellipse cx={x} cy={y} rx="30" ry="7" fill={P} opacity=".35" />
        <ellipse cx={x} cy={y} rx="30" ry="7" fill="none" stroke={P} strokeWidth="1.5" opacity=".8" />
        <circle cx={x} cy={y} r="7" fill="#111827" stroke="#374151" strokeWidth="2" />
        {variant === 'fpv' && <circle cx={x} cy={y} r="33" fill="none" stroke={A} strokeWidth="2" opacity=".5" />}
      </g>
    ))}
    {/* body */}
    <rect x="62" y="82" width="76" height="36" rx="14" fill={body} />
    <rect x="70" y="86" width="60" height="10" rx="5" fill="#111827" opacity=".7" />
    {variant === 'pro' && <rect x="58" y="78" width="84" height="44" rx="16" fill="none" stroke={A} strokeWidth="2" opacity=".6" />}
    {/* camera gimbal */}
    <rect x="86" y="112" width="28" height="18" rx="6" fill="#111827" stroke="#374151" strokeWidth="2" />
    <circle cx="100" cy="121" r="6" fill="url(#sfx-glass)" />
    <circle cx="100" cy="121" r="2.5" fill={P} />
    <circle cx="130" cy="94" r="2.5" fill={A} />
  </>
)

const Battery = () => (
  <>
    <ellipse cx="100" cy="155" rx="60" ry="9" fill="url(#sfx-glow)" />
    <rect x="45" y="60" width="110" height="80" rx="14" fill={body} />
    <rect x="155" y="85" width="10" height="30" rx="4" fill="#374151" />
    <rect x="56" y="70" width="88" height="60" rx="10" fill="#0f172a" opacity=".6" />
    {[0, 1, 2, 3].map(i => <rect key={i} x={64 + i * 20} y="112" width="12" height="8" rx="2" fill={i < 3 ? A : '#334155'} />)}
    <text x="100" y="98" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="800" fontSize="16" fill="#e2e8f0">Li-ion</text>
    <circle cx="140" cy="78" r="3" fill={P} />
  </>
)

const Propeller = () => (
  <>
    <ellipse cx="100" cy="150" rx="55" ry="8" fill="url(#sfx-glow)" />
    <g transform="translate(100 100)">
      <path d="M0 0 C 30 -55, 80 -40, 75 -10 C 60 -5, 20 -4, 0 0Z" fill={body} />
      <path d="M0 0 C -30 55, -80 40, -75 10 C -60 5, -20 4, 0 0Z" fill={body} />
      <path d="M0 0 C 28 -42, 62 -36, 62 -14" fill="none" stroke={P} strokeWidth="2" opacity=".7" />
      <path d="M0 0 C -28 42, -62 36, -62 14" fill="none" stroke={P} strokeWidth="2" opacity=".7" />
      <circle r="12" fill="#111827" stroke="#4b5563" strokeWidth="3" />
      <circle r="4" fill={A} />
    </g>
  </>
)

const Motor = () => (
  <>
    <ellipse cx="100" cy="155" rx="55" ry="8" fill="url(#sfx-glow)" />
    <ellipse cx="100" cy="125" rx="46" ry="14" fill="#0f172a" />
    <rect x="54" y="70" width="92" height="55" rx="8" fill={body} />
    <ellipse cx="100" cy="70" rx="46" ry="14" fill="#374151" />
    <ellipse cx="100" cy="70" rx="30" ry="9" fill="#111827" />
    {[-30, -15, 0, 15, 30].map(x => <rect key={x} x={97 + x} y="80" width="6" height="40" rx="2" fill="#0f172a" opacity=".6" />)}
    <rect x="96" y="40" width="8" height="34" rx="3" fill="#9ca3af" />
    <path d="M60 120 q-20 10 -15 30" fill="none" stroke={P} strokeWidth="3" strokeLinecap="round" />
    <path d="M70 124 q-16 12 -10 30" fill="none" stroke={A} strokeWidth="3" strokeLinecap="round" />
  </>
)

const Gimbal = () => (
  <>
    <ellipse cx="100" cy="155" rx="55" ry="8" fill="url(#sfx-glow)" />
    <rect x="80" y="40" width="40" height="14" rx="5" fill="#374151" />
    <path d="M100 54 v18" stroke="#6b7280" strokeWidth="6" strokeLinecap="round" />
    <path d="M62 86 a38 38 0 0 1 76 0" fill="none" stroke="#4b5563" strokeWidth="8" strokeLinecap="round" />
    <rect x="70" y="84" width="60" height="44" rx="12" fill={body} />
    <circle cx="100" cy="106" r="17" fill="#0f172a" stroke="#4b5563" strokeWidth="3" />
    <circle cx="100" cy="106" r="11" fill="url(#sfx-glass)" />
    <circle cx="100" cy="106" r="5" fill={P} />
    <circle cx="96" cy="101" r="2" fill="#fff" opacity=".8" />
    <circle cx="122" cy="92" r="2.5" fill={A} />
  </>
)

const Controller = () => (
  <>
    <ellipse cx="100" cy="155" rx="65" ry="9" fill="url(#sfx-glow)" />
    <rect x="30" y="70" width="140" height="70" rx="22" fill={body} />
    <rect x="62" y="80" width="76" height="40" rx="6" fill="#0f172a" />
    <rect x="66" y="84" width="68" height="32" rx="4" fill={P} opacity=".25" />
    <circle cx="50" cy="110" r="12" fill="#111827" stroke="#4b5563" strokeWidth="3" />
    <circle cx="150" cy="110" r="12" fill="#111827" stroke="#4b5563" strokeWidth="3" />
    <circle cx="50" cy="110" r="4" fill={A} />
    <circle cx="150" cy="110" r="4" fill={A} />
    <rect x="44" y="56" width="26" height="16" rx="5" fill="#374151" />
    <rect x="130" y="56" width="26" height="16" rx="5" fill="#374151" />
    <line x1="48" y1="56" x2="38" y2="30" stroke="#9ca3af" strokeWidth="4" strokeLinecap="round" />
    <line x1="152" y1="56" x2="162" y2="30" stroke="#9ca3af" strokeWidth="4" strokeLinecap="round" />
  </>
)

const Charger = () => (
  <>
    <ellipse cx="100" cy="155" rx="60" ry="9" fill="url(#sfx-glow)" />
    <rect x="40" y="70" width="120" height="60" rx="12" fill={body} />
    {[0, 1, 2].map(i => <rect key={i} x={52 + i * 36} y="80" width="28" height="40" rx="6" fill="#0f172a" stroke="#374151" strokeWidth="2" />)}
    {[0, 1, 2].map(i => <circle key={i} cx={66 + i * 36} cy="124" r="2.5" fill={i === 0 ? A : P} />)}
    <path d="M160 100 h18 q10 0 10 10 v30" fill="none" stroke="#9ca3af" strokeWidth="4" strokeLinecap="round" />
    <rect x="182" y="138" width="12" height="10" rx="2" fill="#6b7280" />
    <path d="M100 48 l-8 16 h10 l-6 14" fill="none" stroke={A} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </>
)

const Cable = () => (
  <>
    <ellipse cx="100" cy="155" rx="60" ry="9" fill="url(#sfx-glow)" />
    <path d="M40 120 C 60 60, 140 140, 160 80" fill="none" stroke="#1f2937" strokeWidth="14" strokeLinecap="round" />
    <path d="M40 120 C 60 60, 140 140, 160 80" fill="none" stroke={P} strokeWidth="6" strokeLinecap="round" opacity=".8" />
    <rect x="22" y="110" width="26" height="20" rx="5" fill="#6b7280" />
    <rect x="152" y="66" width="26" height="20" rx="5" fill="#6b7280" />
    <rect x="12" y="114" width="12" height="12" rx="2" fill="#d1d5db" />
    <rect x="176" y="70" width="12" height="12" rx="2" fill="#d1d5db" />
  </>
)

const Phone = () => (
  <>
    <ellipse cx="100" cy="160" rx="45" ry="7" fill="url(#sfx-glow)" />
    <rect x="62" y="30" width="76" height="140" rx="16" fill={body} />
    <rect x="68" y="38" width="64" height="124" rx="11" fill="#0f172a" />
    <rect x="68" y="38" width="64" height="124" rx="11" fill="url(#sfx-glow)" opacity=".5" />
    <rect x="88" y="42" width="24" height="6" rx="3" fill="#1f2937" />
    <rect x="76" y="140" width="48" height="4" rx="2" fill="#374151" />
    <circle cx="80" cy="56" r="4" fill={P} />
    <circle cx="92" cy="56" r="4" fill={A} />
  </>
)

const Screen = () => (
  <>
    <ellipse cx="100" cy="160" rx="45" ry="7" fill="url(#sfx-glow)" />
    <rect x="56" y="30" width="88" height="140" rx="12" fill="#0f172a" stroke="#4b5563" strokeWidth="3" />
    <rect x="62" y="36" width="76" height="128" rx="8" fill="url(#sfx-glass)" opacity=".25" />
    <path d="M62 36 L138 164" stroke="#e5e7eb" strokeWidth="1" opacity=".3" />
    <path d="M70 36 L130 164" stroke="#e5e7eb" strokeWidth="1" opacity=".15" />
    <rect x="86" y="40" width="28" height="6" rx="3" fill="#1f2937" />
    <path d="M100 100 l-10 10 m10 -10 l12 -4 m-12 4 l-4 12" stroke={A} strokeWidth="2" fill="none" />
  </>
)

const Filter = () => (
  <>
    <ellipse cx="100" cy="155" rx="55" ry="8" fill="url(#sfx-glow)" />
    {[0, 1, 2].map(i => (
      <g key={i} transform={`translate(${60 + i * 22} ${100 - i * 10})`}>
        <circle r="34" fill="#111827" stroke="#4b5563" strokeWidth="4" />
        <circle r="26" fill={i === 0 ? '#1e293b' : i === 1 ? '#334155' : '#475569'} opacity=".95" />
        <circle r="26" fill="url(#sfx-glass)" opacity=".25" />
        <text y="5" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="11" fill="#e2e8f0">ND{[8, 16, 32][i]}</text>
      </g>
    ))}
  </>
)

const Case = () => (
  <>
    <ellipse cx="100" cy="158" rx="60" ry="8" fill="url(#sfx-glow)" />
    <path d="M70 60 h60 l10 10 v10 h-80 v-10z" fill="#374151" />
    <rect x="40" y="76" width="120" height="76" rx="12" fill={body} />
    <rect x="40" y="76" width="120" height="14" rx="6" fill="#111827" opacity=".4" />
    <rect x="88" y="100" width="24" height="12" rx="4" fill="#111827" stroke="#6b7280" strokeWidth="2" />
    <path d="M80 60 v-8 a20 20 0 0 1 40 0 v8" fill="none" stroke="#9ca3af" strokeWidth="6" strokeLinecap="round" />
    <circle cx="150" cy="140" r="3" fill={P} />
  </>
)

const Arm = () => (
  <>
    <ellipse cx="100" cy="155" rx="60" ry="8" fill="url(#sfx-glow)" />
    <path d="M40 130 L130 70" stroke={body} strokeWidth="16" strokeLinecap="round" />
    <path d="M40 130 L130 70" stroke="#4b5563" strokeWidth="4" strokeLinecap="round" opacity=".5" />
    <rect x="28" y="118" width="30" height="26" rx="8" fill="#374151" />
    <circle cx="140" cy="62" r="14" fill="#111827" stroke="#4b5563" strokeWidth="3" />
    <ellipse cx="140" cy="62" rx="40" ry="8" fill="none" stroke={P} strokeWidth="2" opacity=".7" />
    <circle cx="140" cy="62" r="4" fill={A} />
    <path d="M60 118 q10 -14 24 -16" fill="none" stroke={P} strokeWidth="2.5" />
  </>
)

const Tool = () => (
  <>
    <ellipse cx="100" cy="155" rx="60" ry="8" fill="url(#sfx-glow)" />
    <g transform="rotate(-40 100 100)">
      <rect x="60" y="90" width="80" height="20" rx="6" fill={body} />
      <rect x="130" y="94" width="40" height="12" rx="3" fill="#9ca3af" />
      <rect x="166" y="92" width="8" height="16" rx="2" fill="#d1d5db" />
      <rect x="40" y="92" width="24" height="16" rx="5" fill={P} />
    </g>
    <g transform="rotate(40 100 100) translate(0 20)">
      <rect x="60" y="90" width="80" height="16" rx="6" fill="#374151" />
      <rect x="136" y="92" width="36" height="12" rx="3" fill="#9ca3af" />
      <rect x="44" y="90" width="20" height="16" rx="5" fill={A} />
    </g>
  </>
)

const Laptop = () => (
  <>
    <ellipse cx="100" cy="160" rx="75" ry="8" fill="url(#sfx-glow)" />
    <rect x="46" y="44" width="108" height="76" rx="8" fill={body} />
    <rect x="52" y="50" width="96" height="64" rx="4" fill="#0f172a" />
    <rect x="52" y="50" width="96" height="64" rx="4" fill="url(#sfx-glow)" opacity=".5" />
    <path d="M30 122 h140 l8 14 h-156z" fill="#374151" />
    <rect x="82" y="124" width="36" height="5" rx="2" fill="#111827" />
    <circle cx="100" cy="47" r="1.5" fill={A} />
  </>
)

const Box = () => (
  <>
    <ellipse cx="100" cy="158" rx="60" ry="8" fill="url(#sfx-glow)" />
    <path d="M50 80 L100 58 L150 80 L100 102Z" fill="#4b5563" />
    <path d="M50 80 v50 l50 22 v-50z" fill="#1f2937" />
    <path d="M150 80 v50 l-50 22 v-50z" fill="#111827" />
    <path d="M75 69 L125 91 v12 l-50 -22z" fill={P} opacity=".6" />
    <path d="M100 102 v50" stroke="#0f172a" strokeWidth="2" />
  </>
)

const MAP: Record<IllustrationKey, () => React.JSX.Element> = {
  drone: () => <Drone />, 'drone-fpv': () => <Drone variant="fpv" />, 'drone-pro': () => <Drone variant="pro" />,
  battery: Battery, propeller: Propeller, motor: Motor, gimbal: Gimbal, controller: Controller, charger: Charger, cable: Cable,
  phone: Phone, screen: Screen, filter: Filter, case: Case, arm: Arm, tool: Tool, laptop: Laptop, box: Box,
}

export const ILLUSTRATION_KEYS = Object.keys(MAP) as IllustrationKey[]
export const ILLUSTRATION_LABEL: Record<IllustrationKey, string> = {
  drone: 'درون', 'drone-fpv': 'درون FPV', 'drone-pro': 'درون احترافي', battery: 'بطارية', propeller: 'مروحة', motor: 'موتور', gimbal: 'جيمبال', controller: 'ريموت',
  charger: 'شاحن', cable: 'كابل', phone: 'هاتف', screen: 'شاشة', filter: 'فلتر', case: 'حقيبة', arm: 'ذراع', tool: 'أداة', laptop: 'لابتوب', box: 'صندوق',
}

export function Illustration({ name, className = 'illu' }: { name?: IllustrationKey | string; className?: string }) {
  const Draw = MAP[(name as IllustrationKey) in MAP ? (name as IllustrationKey) : 'box']
  return (
    <svg viewBox="0 0 200 180" className={className} aria-hidden="true">
      <Defs />
      <Draw />
    </svg>
  )
}

/** A product picture: the uploaded photo when there is one, else the illustration. */
export function ProductImage({ image, illustration, alt, className }: { image?: string; illustration?: IllustrationKey | string; alt?: string; className?: string }) {
  if (image) return <img src={image} alt={alt || ''} loading="lazy" className={className} />
  return <Illustration name={illustration} />
}
