'use client'

import type { FormEvent, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity, AlertTriangle, Bell, Bot, CheckCircle2, ChevronRight, CircleHelp, Cloud,
  Droplets, Gauge, LogOut, Menu, PackageCheck, Plus, Radio, RefreshCw, Route,
  KeyRound, MapPin, Navigation, Search, Settings2, ShieldCheck, Sparkles, Truck, UserCog, UserRound, Users, Wifi, X,
} from 'lucide-react'
import { api, type AppUser, type Bin, type Dispatch, type OptimizedRoute, type Role } from '@/lib/api'

const binNames: Record<string, string> = {
  'BIN-01': 'Main entrance', 'BIN-02': 'Cafeteria', 'BIN-03': 'Workshop', 'BIN-04': 'Reception',
}

const navItems = [
  { icon: Gauge, label: 'Overview', href: '/dashboard', view: 'overview', roles: ['customer', 'collector', 'superadmin'] },
  { icon: PackageCheck, label: 'Bins', href: '/bins', view: 'bins', roles: ['customer', 'collector', 'superadmin'] },
  { icon: Route, label: 'Dispatch', href: '/dispatch', view: 'dispatch', roles: ['customer', 'collector', 'superadmin'] },
  { icon: Bot, label: 'AI insights', href: '/ai', view: 'ai', roles: ['customer', 'collector', 'superadmin'] },
  { icon: UserCog, label: 'Administration', href: '/admin', view: 'admin', roles: ['superadmin'] },
] as const

type View = (typeof navItems)[number]['view'] | 'profile'

function currentView(pathname: string): View {
  if (pathname.startsWith('/bins')) return 'bins'
  if (pathname.startsWith('/dispatch')) return 'dispatch'
  if (pathname.startsWith('/ai')) return 'ai'
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/profile')) return 'profile'
  return 'overview'
}

function roleLabel(role: Role) {
  return role === 'superadmin' ? 'Administrator' : role === 'collector' ? 'Collector' : 'Customer'
}

function nameInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return (parts[0]?.slice(0, 2) || '?').toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function lastSeen(value?: string | null) {
  if (!value) return { label: 'No telemetry yet', online: false }
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000))
  return { label: minutes < 1 ? 'Just now' : `${minutes} min ago`, online: minutes <= 30 }
}

function FillBar({ level }: { level: number }) {
  const color = level >= 80 ? 'bg-amber-500' : level >= 60 ? 'bg-amber-300' : 'bg-[#3dbdb5]'
  return <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(100, Math.max(0, level))}%` }} /></div>
}

function StatCard({ label, value, detail, icon: Icon, tone = 'cyan' }: { label: string; value: string; detail: string; icon: typeof Activity; tone?: 'cyan' | 'amber' | 'slate' }) {
  const toneClass = tone === 'amber' ? 'bg-amber-50 text-amber-600' : tone === 'slate' ? 'bg-slate-100 text-slate-600' : 'bg-cyan-50 text-cyan-700'
  return <div className="rounded-2xl border border-[#dde5ef] bg-white p-4 shadow-[0_8px_24px_rgba(21,34,54,0.045)] sm:p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-[#68788d]">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-[#152236] sm:text-3xl">{value}</p></div><div className={`rounded-xl p-3 ${toneClass}`}><Icon size={20} /></div></div><p className="mt-3 text-xs text-[#7a899c]">{detail}</p></div>
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end sm:gap-5"><div><p className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-cyan-700 sm:mb-2 sm:text-sm"><span className="size-2 rounded-full bg-[#3dbdb5]" />{eyebrow}</p><h1 className="text-2xl font-semibold tracking-tight text-[#152236] sm:text-3xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#68788d] sm:text-base">{description}</p></div>{action && <div className="flex gap-2">{action}</div>}</div>
}

function Brand({ light = false }: { light?: boolean }) {
  return light ? <div className="w-fit rounded-2xl bg-[#111c2d] px-4 py-3"><img src="/smartbin-logo.svg" alt="SmartBin Connect" className="h-10 w-auto" /></div> : <img src="/smartbin-logo.svg" alt="SmartBin Connect" className="h-12 w-auto" />
}

function AuthForm({ mode, setMode, onSubmit, loading, message }: { mode: 'signin' | 'signup'; setMode: (mode: 'signin' | 'signup') => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; loading: boolean; message: string }) {
  return <div className="w-full max-w-md rounded-2xl border border-[#dde5ef] bg-white p-5 shadow-[0_20px_60px_rgba(21,34,54,0.1)] sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-cyan-700">SmartBin Connect</p><h2 className="mt-1 text-xl font-semibold text-[#152236]">{mode === 'signin' ? 'Welcome back' : 'Create your customer account'}</h2><p className="mt-1 text-sm text-[#68788d]">{mode === 'signin' ? 'Sign in to manage your connected bins.' : 'Link bins, monitor fill levels, and receive collection alerts.'}</p></div><ShieldCheck className="mt-1 shrink-0 text-cyan-600" size={20} /></div><div className="mt-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm"><button type="button" onClick={() => setMode('signin')} className={`rounded-lg py-2 font-medium ${mode === 'signin' ? 'bg-white text-[#152236] shadow-sm' : 'text-slate-500'}`}>Sign in</button><button type="button" onClick={() => setMode('signup')} className={`rounded-lg py-2 font-medium ${mode === 'signup' ? 'bg-white text-[#152236] shadow-sm' : 'text-slate-500'}`}>Create account</button></div><form onSubmit={onSubmit} className="mt-5 space-y-4">{mode === 'signup' && <label className="block text-sm font-medium text-[#34445a]">Name<input required name="name" autoComplete="name" placeholder="Your name" className="mt-2 w-full min-w-0 rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label>}<label className="block text-sm font-medium text-[#34445a]">Email<input required type="email" name="email" autoComplete="email" placeholder="you@example.com" className="mt-2 w-full min-w-0 rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label><label className="block text-sm font-medium text-[#34445a]">Password<input required minLength={8} type="password" name="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" className="mt-2 w-full min-w-0 rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label>{message && <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-5 text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" /><span>{message}</span></p>}<button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#152236] py-3 text-sm font-semibold text-white hover:bg-[#23344a] disabled:opacity-60">{loading && <RefreshCw size={15} className="animate-spin" />}{mode === 'signin' ? 'Sign in' : 'Create account'}</button></form></div>
}

function AuthGate({ onSubmit, loading, message }: { onSubmit: (event: FormEvent<HTMLFormElement>, mode: 'signin' | 'signup') => void; loading: boolean; message: string }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  return <main className="flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-[#f4f7fb] px-4 py-6 sm:px-5 sm:py-10"><div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr_420px] lg:gap-10 lg:items-center"><section className="hidden lg:block"><Brand light /><p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Connected waste operations</p><h1 className="mt-3 max-w-xl text-5xl font-semibold tracking-tight text-[#152236]">Every bin accounted for. Every pickup on time.</h1><p className="mt-5 max-w-lg text-lg leading-8 text-[#68788d]">SmartBin Connect brings customer bin monitoring, AI-prioritized collection, and field operations into one secure workspace.</p><div className="mt-8 flex items-center gap-3 text-sm text-[#516176]"><CheckCircle2 size={18} className="text-cyan-600" />ESP32 telemetry with role-based access</div></section><AuthForm mode={mode} setMode={setMode} onSubmit={(event) => onSubmit(event, mode)} loading={loading} message={message} /></div></main>
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <section className="rounded-2xl border border-dashed border-[#cbd7e5] bg-white p-10 text-center"><div className="mx-auto grid size-12 place-items-center rounded-full bg-cyan-50 text-cyan-700"><PackageCheck size={22} /></div><h2 className="mt-4 font-semibold text-[#152236]">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#68788d]">{description}</p></section>
}

function OverviewScreen({ bins, dispatch, average, urgent, role, onRegister }: { bins: Bin[]; dispatch: Dispatch[]; average: number; urgent: number; role: Role; onRegister: () => void }) {
  const scope = role === 'customer' ? 'your connected bins' : role === 'collector' ? 'the collection fleet' : 'the complete SmartBin network'
  return <div className="space-y-6">
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#dde5ef] bg-white p-4 shadow-[0_12px_32px_rgba(21,34,54,0.05)]">
      <p className="mr-auto text-sm font-semibold text-[#152236]">Quick actions</p>
      <Link href="/bins" className="rounded-xl border border-[#d7e0eb] px-4 py-2.5 text-sm font-semibold text-[#34445a] hover:border-cyan-300">{role === 'customer' ? 'Manage bins and request pickup' : role === 'collector' ? 'Review fleet bins' : 'Manage devices and locations'}</Link>
      <Link href="/dispatch" className="flex items-center gap-2 rounded-xl border border-[#d7e0eb] px-4 py-2.5 text-sm font-semibold text-[#34445a] hover:border-cyan-300">Review collections{dispatch.length > 0 ? ` (${dispatch.length})` : ''}</Link>
      {role === 'superadmin' && <button type="button" onClick={onRegister} className="rounded-xl bg-[#152236] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#23344a]">Register a bin</button>}
    </section>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Tracked bins" value={String(bins.length)} detail={`Visible across ${scope}`} icon={PackageCheck} /><StatCard label="Average fill level" value={`${average}%`} detail="Across active telemetry" icon={Droplets} /><StatCard label="Needs attention" value={String(urgent)} detail={urgent ? 'Collection recommended' : 'Everything is healthy'} icon={AlertTriangle} tone="amber" /><StatCard label="Open dispatch" value={String(dispatch.length)} detail="AI-prioritized collection tasks" icon={Truck} tone="slate" /></div>
    {bins.length ? <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
      <section className="rounded-2xl border border-[#dde5ef] bg-white p-5 shadow-[0_12px_32px_rgba(21,34,54,0.05)] sm:p-6"><div className="flex items-start justify-between"><div><h2 className="font-semibold text-[#152236]">Network overview</h2><p className="mt-1 text-sm text-[#68788d]">Latest fill levels from registered devices</p></div><Activity size={19} className="text-cyan-600" /></div><div className="mt-8 flex h-52 items-end gap-3 border-b border-l border-slate-100 px-3 pb-0 pt-4 sm:gap-5">{bins.map((bin) => <Link key={bin.bin_id} href={`/bins#bin-${encodeURIComponent(bin.bin_id)}`} aria-label={`View ${bin.name ?? binNames[bin.bin_id] ?? bin.bin_id}`} className="group relative flex h-full flex-1 items-end"><div className={`w-full rounded-t-lg ${bin.fill_level >= 80 ? 'bg-amber-500' : bin.fill_level >= 60 ? 'bg-amber-300' : 'bg-[#3dbdb5]'}`} style={{ height: `${Math.max(12, bin.fill_level)}%` }} /><span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium text-[#68788d] opacity-0 transition group-hover:opacity-100">{Math.round(bin.fill_level)}%</span><span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-[#7a899c]">{bin.name || binNames[bin.bin_id] || bin.bin_id}</span></Link>)}</div></section>
      <section className="rounded-2xl border border-[#23344a] bg-[#142439] p-5 text-white shadow-[0_16px_40px_rgba(20,36,57,0.16)] sm:p-6"><div className="flex items-center gap-2"><div className="rounded-lg bg-cyan-400/15 p-2 text-[#7cd6cf]"><Sparkles size={18} /></div><h2 className="font-semibold">AI operations brief</h2></div><p className="mt-5 text-sm leading-6 text-slate-300">{urgent ? `${urgent} ${urgent === 1 ? 'bin is' : 'bins are'} approaching capacity and should be routed soon.` : 'The network is stable. No immediate collection action is required.'}</p><div className="mt-6 space-y-3"><Link href="/dispatch" className="flex items-center gap-3 rounded-xl bg-white/8 p-3 hover:bg-white/12"><div className="rounded-lg bg-amber-400/15 p-2 text-amber-300"><Truck size={16} /></div><div className="flex-1"><p className="text-sm font-medium">Route suggestions</p><p className="text-xs text-slate-400">Open the collection queue and route planner</p></div><ChevronRight size={16} className="text-slate-500" /></Link><Link href="/bins" className="flex items-center gap-3 rounded-xl bg-white/8 p-3 hover:bg-white/12"><div className="rounded-lg bg-cyan-400/15 p-2 text-[#7cd6cf]"><Wifi size={16} /></div><div className="flex-1"><p className="text-sm font-medium">Device telemetry</p><p className="text-xs text-slate-400">Review device status, addresses, and fill levels</p></div><ChevronRight size={16} className="text-slate-500" /></Link></div></section>
    </div> : <EmptyState title={role === 'customer' ? 'No bins linked yet' : 'No bins registered yet'} description={role === 'customer' ? 'Ask an administrator for a bin ID and claim code to link your first SmartBin.' : role === 'collector' ? 'Ask an administrator to register the devices for your fleet.' : 'Register a device before it can send telemetry to the platform.'} />}
  </div>
}
function BinsScreen({ bins, dispatch, role, onLink, onRegister, onRequestCollection, requestPendingId, requestFeedback }: { bins: Bin[]; dispatch: Dispatch[]; role: Role; onLink: () => void; onRegister: () => void; onRequestCollection: (binId: string) => void; requestPendingId: string | null; requestFeedback: { binId: string; message: string; error: boolean } | null }) {
  const canLink = role === 'customer'
  const canRegister = role === 'superadmin'
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Registered bins" value={String(bins.length)} detail={role === 'customer' ? 'Linked to your account' : 'Registered in the fleet'} icon={PackageCheck} /><StatCard label="Online now" value={String(bins.filter((bin) => lastSeen(bin.last_seen).online).length)} detail="Last check-in within 30 minutes" icon={Wifi} /><StatCard label="Average fill" value={`${bins.length ? Math.round(bins.reduce((sum, bin) => sum + bin.fill_level, 0) / bins.length) : 0}%`} detail="Across visible telemetry" icon={Droplets} /></div>
    <section className="rounded-2xl border border-[#dde5ef] bg-white p-5 shadow-[0_12px_32px_rgba(21,34,54,0.05)] sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="font-semibold text-[#152236]">{role === 'customer' ? 'Your connected bins' : 'Fleet inventory'}</h2><p className="mt-1 text-sm text-[#68788d]">Live device status, fill levels, and collection actions</p></div>{canLink && <button type="button" onClick={onLink} className="flex items-center justify-center gap-2 rounded-xl bg-[#152236] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#23344a]"><Plus size={16} />Link a bin</button>}{canRegister && <button type="button" onClick={onRegister} className="flex items-center justify-center gap-2 rounded-xl bg-[#152236] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#23344a]"><Plus size={16} />Register device</button>}</div>
    {bins.length ? <div className="mt-6 space-y-3">{bins.map((bin) => { const status = lastSeen(bin.last_seen); const hasOpenRequest = dispatch.some((task) => task.bin_id === bin.bin_id); const isRequesting = requestPendingId === bin.bin_id; return <article id={`bin-${bin.bin_id}`} key={bin.bin_id} className="scroll-mt-28 rounded-xl border border-[#e4eaf2] p-4 transition hover:border-cyan-300 hover:shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className={`grid size-11 place-items-center rounded-xl ${bin.fill_level >= 80 ? 'bg-amber-50 text-amber-700' : 'bg-cyan-50 text-cyan-700'}`}><PackageCheck size={20} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-[#152236]">{bin.name || binNames[bin.bin_id] || bin.bin_id}</p><span className="text-xs text-[#7a899c]">{bin.bin_id}</span></div><p className="mt-1 flex items-center gap-1.5 text-xs text-[#68788d]"><MapPin size={13} className="shrink-0 text-cyan-700" />{bin.address || 'Address not added'}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-[#7a899c]"><Radio size={12} className={status.online ? 'text-cyan-600' : 'text-slate-400'} />{status.online ? 'Online' : 'Offline'} · {status.label}</p>{role !== 'customer' && <p className="mt-1 text-xs text-[#68788d]">Owner: {bin.owner_name ?? 'Unassigned'}{bin.owner_email ? ` · ${bin.owner_email}` : ''}</p>}</div><div className="w-full sm:w-48"><div className="mb-2 flex items-center justify-between text-xs"><span className="text-[#7a899c]">Capacity used</span><span className={`font-semibold ${bin.fill_level >= 80 ? 'text-amber-700' : 'text-[#152236]'}`}>{Math.round(bin.fill_level)}%</span></div><FillBar level={bin.fill_level} /></div></div>
    {canLink && <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3"><button type="button" onClick={() => onRequestCollection(bin.bin_id)} disabled={hasOpenRequest || isRequesting} className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"><Truck size={14} />{hasOpenRequest ? 'Collection requested' : isRequesting ? 'Sending request…' : 'Request collection'}</button>{requestFeedback?.binId === bin.bin_id && <p role={requestFeedback.error ? 'alert' : 'status'} className={`text-xs ${requestFeedback.error ? 'text-rose-700' : 'text-cyan-800'}`}>{requestFeedback.message}</p>}</div>}</article>})}</div> : <div className="mt-7"><EmptyState title={role === 'customer' ? 'No linked bins yet' : 'No registered devices yet'} description={role === 'customer' ? 'Ask an administrator for a bin ID and claim code, then select Link a bin.' : role === 'collector' ? 'An administrator must register a device before it appears in the fleet.' : 'Select Register device to add its ID, name, service address, and claim code.'} /></div>}</section>
  </div>
}
function routeDirectionsUrl(route: OptimizedRoute | undefined, bins: Bin[]) {
  if (!route?.stops.length || route.stops.length > 9) return null
  const origin = `${route.origin_latitude},${route.origin_longitude}`
  const waypoints = route.stops.map((stop) => {
    const bin = bins.find((item) => item.bin_id === stop.bin_id)
    if (bin?.latitude != null && bin.longitude != null) return `${bin.latitude},${bin.longitude}`
    return bin?.address?.trim() || stop.address?.trim() || null
  })
  if (waypoints.some((point) => !point)) return null
  const url = new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api', '1')
  url.searchParams.set('origin', origin)
  url.searchParams.set('destination', origin)
  url.searchParams.set('waypoints', waypoints.join('|'))
  url.searchParams.set('travelmode', 'driving')
  return url.toString()
}

function DispatchScreen({ dispatch, bins, role, onClose, route, routeLoading }: { dispatch: Dispatch[]; bins: Bin[]; role: Role; onClose: (id: number) => void; route?: OptimizedRoute; routeLoading: boolean }) {
  const operational = role === 'collector' || role === 'superadmin'
  const directionsUrl = routeDirectionsUrl(route, bins)
  const routeLinkMessage = route?.stops.length && route.stops.length > 9 ? 'Split this run into routes with nine stops or fewer to open it in Maps.' : 'Add an address or coordinates to every stop before starting this route.'

  return <div className="space-y-6">
    {operational && <section className="rounded-2xl border border-[#23344a] bg-[#142439] p-4 text-white shadow-[0_16px_40px_rgba(20,36,57,0.16)] sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2 text-[#7cd6cf]"><Route size={18} /><p className="text-xs font-semibold sm:text-sm">AI-optimized collection route</p></div><h2 className="mt-2 text-xl font-semibold sm:text-2xl">Today’s recommended run</h2><p className="mt-1 text-sm text-slate-400">Priority, bin capacity, and location are combined into one stop order.</p></div><span className="w-fit rounded-full bg-cyan-400/15 px-3 py-1.5 text-xs font-semibold text-[#a9e9e4]">{route?.stops.length ? 'Route ready' : 'No route required'}</span></div>
      {routeLoading ? <div className="mt-6 flex items-center gap-2 rounded-xl bg-white/8 p-4 text-sm text-slate-300"><RefreshCw size={16} className="animate-spin text-[#7cd6cf]" />Building the best stop order…</div> : route?.stops.length ? <>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl bg-white/8 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Stops</p><p className="mt-2 text-2xl font-semibold">{route.stops.length}</p></div><div className="rounded-xl bg-white/8 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Total trip</p><p className="mt-2 text-2xl font-semibold">{route.total_distance_km.toFixed(1)} km</p><p className="mt-1 text-xs text-slate-500">Round trip to site</p></div><div className="rounded-xl bg-white/8 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">To first bin</p><p className="mt-2 text-2xl font-semibold">{route.distance_to_first_km.toFixed(1)} km</p><p className="mt-1 text-xs text-slate-500">From disposal site</p></div><div className="rounded-xl bg-white/8 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Return to site</p><p className="mt-2 text-2xl font-semibold">{route.return_distance_km.toFixed(1)} km</p><p className="mt-1 text-xs text-slate-500">After final collection · {route.estimated_minutes} min total</p></div></div>
        <div className="mt-6 space-y-3">{route.stops.map((stop) => { const bin = bins.find((item) => item.bin_id === stop.bin_id); return <div key={stop.bin_id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"><div className="grid size-9 shrink-0 place-items-center rounded-full bg-cyan-400/15 text-sm font-semibold text-[#a9e9e4]">{stop.sequence}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{bin?.name || stop.bin_name || binNames[stop.bin_id] || stop.bin_id}</p><span className="text-xs text-slate-500">{stop.bin_id}</span></div>{(bin?.address || stop.address) && <p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><MapPin size={12} />{bin?.address || stop.address}</p>}<p className="mt-1 text-xs text-slate-400">{stop.owner_name ? `${stop.owner_name} · ` : ''}{stop.reason}{stop.location_available ? ` · ${stop.distance_from_previous_km.toFixed(1)} km from previous` : ' · distance estimate unavailable'}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${stop.priority === 'urgent' ? 'bg-rose-400/15 text-rose-200' : 'bg-amber-400/15 text-amber-200'}`}>{stop.priority}</span><span className="text-sm font-semibold text-[#a9e9e4]">{Math.round(stop.fill_level)}%</span></div>})}</div>
        {route.unlocated_stops > 0 && <p className="mt-4 text-xs leading-5 text-amber-200">Add latitude and longitude to improve distance estimates. Street addresses can still be used for map navigation.</p>}
        <div className="mt-5 flex flex-wrap items-center gap-3"><a href={directionsUrl ?? undefined} target="_blank" rel="noreferrer" aria-disabled={!directionsUrl} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${directionsUrl ? 'bg-[#7cd6cf] text-[#142439] hover:bg-[#61c9c1]' : 'cursor-not-allowed bg-white/10 text-slate-500'}`}><Navigation size={16} />Start route in Google Maps</a>{!directionsUrl && <p className="text-xs text-amber-200">{routeLinkMessage}</p>}</div>
        <p className="mt-4 text-xs text-slate-500">Outbound route: {route.outbound_distance_km.toFixed(1)} km · Between stops: {route.between_stops_distance_km.toFixed(1)} km · Optimizer: {route.algorithm}{route.estimated_savings_percent ? ` · estimated ${route.estimated_savings_percent}% route saving` : ''}</p>
      </> : <div className="mt-6 rounded-xl border border-dashed border-white/15 p-5 text-sm text-slate-400">No open collection tasks need a route right now.</div>}
    </section>}
    <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Open tasks" value={String(dispatch.length)} detail={role === 'customer' ? 'Your collection requests' : 'Awaiting field collection'} icon={Truck} tone="amber" /><StatCard label="High priority" value={String(dispatch.filter((task) => task.priority === 'high' || task.priority === 'urgent').length)} detail="Should be routed first" icon={AlertTriangle} tone="amber" /><StatCard label="Route efficiency" value={route?.estimated_savings_percent ? `${route.estimated_savings_percent}%` : '—'} detail={operational ? 'Estimated route saving' : 'Available to the collection team'} icon={Route} tone="slate" /></div>
    <section className="rounded-2xl border border-[#dde5ef] bg-white p-5 shadow-[0_12px_32px_rgba(21,34,54,0.05)] sm:p-6"><div><h2 className="font-semibold text-[#152236]">{operational ? 'Operations queue' : 'Collection requests'}</h2><p className="mt-1 text-sm text-[#68788d]">{operational ? 'AI-prioritized tasks ready for route assignment' : 'Track and request collection for your bins'}</p></div>{dispatch.length ? <div className="mt-6 grid gap-3 md:grid-cols-2">{dispatch.map((task) => <article id={`dispatch-${task.id}`} key={task.id} className="scroll-mt-28 rounded-xl border border-amber-200 bg-amber-50/70 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-[#152236]">{task.bin_name || binNames[task.bin_id] || task.bin_id}</p><p className="mt-1 text-xs text-[#7a899c]">{task.bin_id}{operational && task.owner_name ? ` · ${task.owner_name}` : ''}</p>{task.address && <p className="mt-1 flex items-center gap-1 text-xs text-[#68788d]"><MapPin size={12} />{task.address}</p>}</div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">{task.priority}</span></div><p className="mt-4 text-sm text-[#516176]">{task.reason}</p>{operational ? <button type="button" onClick={() => onClose(task.id)} className="mt-4 flex items-center gap-2 text-xs font-semibold text-amber-700 hover:text-amber-900"><CheckCircle2 size={14} />Mark collected</button> : <div className="mt-4 flex items-center gap-2 text-xs font-medium text-amber-700"><Truck size={14} />Awaiting collection</div>}</article>)}</div> : <div className="mt-7"><EmptyState title="No open collection tasks" description="Your network is being monitored continuously. New priority tasks will appear here automatically." /></div>}<div className="mt-6 flex items-center gap-2 rounded-xl border border-dashed border-[#d7e0eb] p-3 text-xs text-[#68788d]"><Cloud size={15} className="text-cyan-600" />Telemetry is synced automatically every 30 seconds</div></section>
  </div>
}
function AiScreen({ bins, urgent, average }: { bins: Bin[]; urgent: number; average: number }) {
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Prediction model" value="Online" detail="Hugging Face model loaded" icon={Bot} /><StatCard label="Signals analysed" value={String(bins.length)} detail="Latest bin readings" icon={Activity} /><StatCard label="Fleet forecast" value={urgent ? 'Action' : 'Stable'} detail={`${average}% average capacity used`} icon={Sparkles} tone={urgent ? 'amber' : 'cyan'} /></div><div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><section className="rounded-2xl border border-[#23344a] bg-[#142439] p-6 text-white shadow-[0_16px_40px_rgba(20,36,57,0.16)]"><div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-400/15 p-3 text-[#7cd6cf]"><Sparkles size={22} /></div><div><p className="text-sm font-semibold text-[#7cd6cf]">SmartBin prediction pipeline</p><h2 className="mt-1 text-2xl font-semibold">From sensor reading to route decision</h2></div></div><div className="mt-8 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-white/8 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">01 · Device</p><p className="mt-2 text-sm font-medium">ESP32 telemetry</p><p className="mt-1 text-xs leading-5 text-slate-400">Ultrasonic fill level, Wi-Fi signal, and lid status.</p></div><div className="rounded-xl bg-white/8 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">02 · Model</p><p className="mt-2 text-sm font-medium">Hugging Face predictor</p><p className="mt-1 text-xs leading-5 text-slate-400">Estimates time until capacity using learned patterns.</p></div><div className="rounded-xl bg-white/8 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">03 · Action</p><p className="mt-2 text-sm font-medium">Dispatch priority</p><p className="mt-1 text-xs leading-5 text-slate-400">Creates a collection task when a bin needs attention.</p></div></div></section><section className="rounded-2xl border border-[#dde5ef] bg-white p-6 shadow-[0_12px_32px_rgba(21,34,54,0.05)]"><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-cyan-700" /><h2 className="font-semibold text-[#152236]">Model status</h2></div><div className="mt-6 space-y-4 text-sm"><div className="flex items-center justify-between border-b border-slate-100 pb-4"><span className="text-[#68788d]">Repository</span><span className="font-medium text-[#152236]">smartbin-fill-predictor</span></div><div className="flex items-center justify-between border-b border-slate-100 pb-4"><span className="text-[#68788d]">Runtime</span><span className="font-medium text-cyan-700">FastAPI · ready</span></div><div className="flex items-center justify-between"><span className="text-[#68788d]">Fallback</span><span className="font-medium text-[#152236]">Explainable rule set</span></div></div></section></div></div>
}

function AdminScreen({ users, currentUserId, pendingUserId, roleFeedback, onRoleChange }: { users: AppUser[]; currentUserId: string; pendingUserId: string | null; roleFeedback: { userId: string; message: string; error: boolean } | null; onRoleChange: (id: string, role: Role) => void }) {
  const roles: { id: Role; title: string; detail: string; tone: string }[] = [
    { id: 'customer', title: 'Customer', detail: 'Links their bins and requests collections.', tone: 'bg-cyan-50 text-cyan-800' },
    { id: 'collector', title: 'Collector', detail: 'Views the fleet, starts routes, and closes pickups.', tone: 'bg-slate-100 text-slate-700' },
    { id: 'superadmin', title: 'Administrator', detail: 'Registers devices and manages users and roles.', tone: 'bg-[#152236] text-white' },
  ]
  const counts = { customer: users.filter((item) => item.role === 'customer').length, collector: users.filter((item) => item.role === 'collector').length, superadmin: users.filter((item) => item.role === 'superadmin').length }
  return <div className="space-y-5 sm:space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Accounts" value={String(users.length)} detail="Registered platform users" icon={Users} /><StatCard label="Customers" value={String(counts.customer)} detail="Bin owners and tenants" icon={PackageCheck} /><StatCard label="Collectors" value={String(counts.collector)} detail="Field operations staff" icon={Truck} tone="slate" /><StatCard label="Administrators" value={String(counts.superadmin)} detail="Platform access managers" icon={ShieldCheck} /></div>
    <section className="rounded-2xl border border-[#dde5ef] bg-white p-4 shadow-[0_8px_24px_rgba(21,34,54,0.045)] sm:p-6">
      <div><h2 className="font-semibold text-[#152236]">People and roles</h2><p className="mt-1 text-sm text-[#68788d]">Choose each person’s access. Role changes take effect on their next request.</p></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">{roles.map((item) => <div key={item.id} className="rounded-xl border border-[#e5eaf1] bg-[#f8fafc] p-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.tone}`}>{item.title}</span><p className="mt-2 text-xs leading-5 text-[#68788d]">{item.detail}</p></div>)}</div>
      <div className="mt-5 space-y-3">{users.map((item) => {
        const isCurrentUser = item.id === currentUserId
        const isUpdating = item.id === pendingUserId
        const label = roleFeedback?.userId === item.id ? roleFeedback.message : isCurrentUser ? 'Your own role is protected.' : 'You can change this role.'
        return <article key={item.id} className="rounded-xl border border-[#e5eaf1] p-3 sm:p-4">
          <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#152236]">{item.name}{isCurrentUser && <span className="ml-2 inline-flex rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-800">You</span>}</p><p className="mt-1 truncate text-xs text-[#68788d]">{item.email}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${roles.find((entry) => entry.id === item.role)?.tone ?? roles[0].tone}`}>{roleLabel(item.role)}</span></div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><label className="text-xs font-medium text-[#68788d]" htmlFor={`role-${item.id}`}>Access role<select id={`role-${item.id}`} disabled={isCurrentUser || isUpdating} value={item.role} onChange={(event) => onRoleChange(item.id, event.target.value as Role)} className="mt-1.5 block w-full rounded-lg border border-[#d7e0eb] bg-white px-3 py-2 text-sm text-[#34445a] disabled:cursor-not-allowed disabled:bg-slate-50 sm:w-52"><option value="customer">Customer</option><option value="collector">Collector</option><option value="superadmin">Administrator</option></select></label><p role={roleFeedback?.userId === item.id ? roleFeedback.error ? 'alert' : 'status' : undefined} className={`text-xs ${roleFeedback?.userId === item.id && roleFeedback.error ? 'text-rose-700' : 'text-[#7a899c]'}`}>{isUpdating ? 'Updating access…' : label}</p></div>
        </article>
      })}</div>
      {!users.length && <div className="mt-5"><EmptyState title="No accounts found" description="New accounts will appear here after registration." /></div>}
    </section>
  </div>
}

function ProfileScreen({ user }: { user: AppUser }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(user.name)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const profileMutation = useMutation({
    mutationFn: () => api.updateProfile(name.trim()),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['session'] }); setProfileSuccess(true); setProfileMessage('Your profile has been updated.') },
    onError: (error: Error) => { setProfileSuccess(false); setProfileMessage(error.message) },
  })
  const passwordMutation = useMutation({
    mutationFn: () => api.changePassword(currentPassword, newPassword),
    onSuccess: () => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordSuccess(true); setPasswordMessage('Your password has been changed.') },
    onError: (error: Error) => { setPasswordSuccess(false); setPasswordMessage(error.message) },
  })

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setProfileMessage(''); setProfileSuccess(false)
    if (name.trim().length < 2) return setProfileMessage('Enter a name with at least 2 characters.')
    if (name.trim() === user.name) return setProfileMessage('There are no profile changes to save.')
    profileMutation.mutate()
  }

  function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPasswordMessage(''); setPasswordSuccess(false)
    if (newPassword.length < 8) return setPasswordMessage('Use a password with at least 8 characters.')
    if (newPassword !== confirmPassword) return setPasswordMessage('The new passwords do not match.')
    passwordMutation.mutate()
  }

  const initials = nameInitials(user.name)
  return <div className="space-y-6"><section className="rounded-2xl border border-[#23344a] bg-[#142439] p-6 text-white shadow-[0_16px_40px_rgba(20,36,57,0.16)]"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-cyan-400/15 text-xl font-semibold text-[#a9e9e4]">{initials}</div><div><p className="text-sm font-semibold text-[#7cd6cf]">Account profile</p><h2 className="mt-1 text-2xl font-semibold">{user.name}</h2><div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300"><span>{user.email}</span><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-[#a9e9e4]">{roleLabel(user.role)}</span></div></div></div></section><div className="grid gap-5 xl:grid-cols-2"><section className="rounded-2xl border border-[#dde5ef] bg-white p-5 shadow-[0_12px_32px_rgba(21,34,54,0.05)] sm:p-6"><div className="flex items-start gap-3"><div className="rounded-xl bg-cyan-50 p-3 text-cyan-700"><UserRound size={19} /></div><div><h2 className="font-semibold text-[#152236]">Personal details</h2><p className="mt-1 text-sm text-[#68788d]">Keep the name shown across your workspace up to date.</p></div></div><form onSubmit={saveProfile} className="mt-6 space-y-4"><label className="block text-sm font-medium text-[#34445a]">Display name<input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label><label className="block text-sm font-medium text-[#34445a]">Email address<input value={user.email} readOnly aria-describedby="email-note" className="mt-2 w-full cursor-not-allowed rounded-xl border border-[#d7e0eb] bg-slate-50 px-3 py-2.5 text-[#68788d] outline-none" /></label><p id="email-note" className="text-xs leading-5 text-[#7a899c]">Your email is used for sign-in and cannot be changed from this screen.</p>{profileMessage && <p role="alert" className={`rounded-xl border px-3 py-2.5 text-sm ${profileSuccess ? 'border-cyan-200 bg-cyan-50 text-cyan-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{profileMessage}</p>}<button disabled={profileMutation.isPending} className="flex items-center justify-center gap-2 rounded-xl bg-[#152236] px-4 py-3 text-sm font-semibold text-white hover:bg-[#23344a] disabled:opacity-60">{profileMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Settings2 size={16} />}Save profile</button></form></section><section className="rounded-2xl border border-[#dde5ef] bg-white p-5 shadow-[0_12px_32px_rgba(21,34,54,0.05)] sm:p-6"><div className="flex items-start gap-3"><div className="rounded-xl bg-cyan-50 p-3 text-cyan-700"><KeyRound size={19} /></div><div><h2 className="font-semibold text-[#152236]">Password and security</h2><p className="mt-1 text-sm text-[#68788d]">Change your password without leaving the dashboard.</p></div></div><form onSubmit={savePassword} className="mt-6 space-y-4"><label className="block text-sm font-medium text-[#34445a]">Current password<input value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required type="password" autoComplete="current-password" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label><label className="block text-sm font-medium text-[#34445a]">New password<input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={8} type="password" autoComplete="new-password" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label><label className="block text-sm font-medium text-[#34445a]">Confirm new password<input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} type="password" autoComplete="new-password" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label>{passwordMessage && <p role="alert" className={`rounded-xl border px-3 py-2.5 text-sm ${passwordSuccess ? 'border-cyan-200 bg-cyan-50 text-cyan-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{passwordMessage}</p>}<button disabled={passwordMutation.isPending} className="flex items-center justify-center gap-2 rounded-xl bg-[#152236] px-4 py-3 text-sm font-semibold text-white hover:bg-[#23344a] disabled:opacity-60">{passwordMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <KeyRound size={16} />}Change password</button></form></section></div></div>
}

function AddCollectorModal({ onClose, onSubmit, loading, message }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; loading: boolean; message: string }) {
  return <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-[#0f172a]/40 px-4 py-6"><div className="w-full max-w-md rounded-2xl border border-[#dde5ef] bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-cyan-700">Platform access</p><h2 className="mt-1 text-lg font-semibold text-[#152236]">Add a collector</h2><p className="mt-1 text-sm text-[#68788d]">Create a field-operations account for the dispatch queue.</p></div><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><X size={18} /></button></div><form onSubmit={onSubmit} className="mt-6 space-y-4"><label className="block text-sm font-medium text-[#34445a]">Full name<input required name="name" placeholder="Collector name" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label><label className="block text-sm font-medium text-[#34445a]">Email address<input required type="email" name="email" placeholder="collector@example.com" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label><label className="block text-sm font-medium text-[#34445a]">Temporary password<input required minLength={8} type="password" name="password" placeholder="At least 8 characters" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label><p className="text-xs leading-5 text-[#7a899c]">Share the temporary password securely. The collector can change it from Profile and access.</p>{message && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">{message}</p>}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl border border-[#d7e0eb] px-4 py-3 text-sm font-semibold text-[#516176] hover:bg-slate-50">Cancel</button><button disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-[#152236] px-4 py-3 text-sm font-semibold text-white hover:bg-[#23344a] disabled:opacity-60">{loading && <RefreshCw size={16} className="animate-spin" />}Create collector</button></div></form></div></div>
}

function LinkBinModal({ onClose, onSubmit, loading, message, admin = false }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; loading: boolean; message: string; admin?: boolean }) {
  return <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-[#0f172a]/40 px-4 py-6"><div className="my-auto max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-[#dde5ef] bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-[#152236]">{admin ? 'Register a smart bin' : 'Link a smart bin'}</h2><p className="mt-1 text-sm text-[#68788d]">{admin ? 'Add the device before it connects to the platform.' : 'Use the bin ID and claim code supplied by your site administrator.'}</p></div><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><X size={18} /></button></div><form onSubmit={onSubmit} className="mt-6 space-y-4"><label className="block text-sm font-medium text-[#34445a]">Bin ID<input required name="bin_id" placeholder="BIN-05" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label><label className="block text-sm font-medium text-[#34445a]">Claim code<input required name="claim_code" placeholder={admin ? 'Create a code to share with the owner' : 'Enter the code from your administrator'} className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label>{admin && <><label className="block text-sm font-medium text-[#34445a]">Bin name<input required name="name" placeholder="Cafeteria entrance" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label><label className="block text-sm font-medium text-[#34445a]">Service address<input required name="address" placeholder="Street, area, city" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label><div><p className="text-sm font-medium text-[#34445a]">Map coordinates <span className="font-normal text-[#7a899c]">(optional)</span></p><div className="mt-2 grid grid-cols-2 gap-3"><input type="number" step="any" min="-90" max="90" name="latitude" aria-label="Latitude" placeholder="Latitude" className="w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /><input type="number" step="any" min="-180" max="180" name="longitude" aria-label="Longitude" placeholder="Longitude" className="w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></div><p className="mt-2 text-xs leading-5 text-[#7a899c]">Coordinates improve route distance estimates. The street address is enough for map navigation.</p></div></>}{!admin && <p className="text-xs leading-5 text-[#7a899c]">To add a new device, an administrator registers its ID, claim code, name, and address under Bins first.</p>}{message && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p>}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl border border-[#d7e0eb] px-4 py-3 text-sm font-semibold text-[#516176] hover:bg-slate-50">Cancel</button><button disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-[#152236] px-4 py-3 text-sm font-semibold text-white hover:bg-[#23344a] disabled:opacity-60">{loading && <RefreshCw size={15} className="animate-spin" />}{admin ? 'Register device' : 'Link device'}</button></div></form></div></div>
}
export default function Dashboard() {
  const pathname = usePathname()
  const view = currentView(pathname)
  const queryClient = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [modal, setModal] = useState<'claim' | 'register' | 'collector' | null>(null)
  const [modalMessage, setModalMessage] = useState('')
  const [search, setSearch] = useState('')
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [greeting, setGreeting] = useState('Good day')
  const [requestPendingId, setRequestPendingId] = useState<string | null>(null)
  const [requestFeedback, setRequestFeedback] = useState<{ binId: string; message: string; error: boolean } | null>(null)
  const [roleFeedback, setRoleFeedback] = useState<{ userId: string; message: string; error: boolean } | null>(null)
  const notificationRef = useRef<HTMLDivElement>(null)

  const sessionQuery = useQuery({ queryKey: ['session'], queryFn: api.session, retry: false, staleTime: 5 * 60_000 })
  const signedIn = Boolean(sessionQuery.data)
  const role: Role = sessionQuery.data?.user.role ?? 'customer'
  const binsQuery = useQuery({ queryKey: ['bins'], queryFn: api.bins, enabled: signedIn, refetchInterval: 30_000 })
  const dispatchQuery = useQuery({ queryKey: ['dispatch'], queryFn: api.dispatch, enabled: signedIn, refetchInterval: 30_000 })
  const routeQuery = useQuery({ queryKey: ['optimized-route'], queryFn: api.optimizedRoute, enabled: signedIn && (role === 'collector' || role === 'superadmin'), refetchInterval: 30_000 })
  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: api.users, enabled: signedIn && role === 'superadmin' })
  const authMutation = useMutation({ mutationFn: async ({ mode, name, email, password }: { mode: 'signin' | 'signup'; name: string; email: string; password: string }) => mode === 'signin' ? api.signIn(email, password) : api.signUp(name, email, password), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['session'] }); setAuthMessage('') }, onError: (error: Error) => setAuthMessage(error.message) })
  const signOutMutation = useMutation({ mutationFn: api.signOut, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['session'] }); setAccountOpen(false) } })
  const claimMutation = useMutation({ mutationFn: ({ id, code }: { id: string; code: string }) => api.claimBin(id, code), onSuccess: async () => { setModal(null); setModalMessage(''); await queryClient.invalidateQueries({ queryKey: ['bins'] }) }, onError: (error: Error) => setModalMessage(error.message) })
  const registerMutation = useMutation({ mutationFn: api.registerBin, onSuccess: async () => { setModal(null); setModalMessage(''); await queryClient.invalidateQueries({ queryKey: ['bins'] }) }, onError: (error: Error) => setModalMessage(error.message) })
  const closeMutation = useMutation({ mutationFn: api.closeDispatch, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['dispatch'] }); await queryClient.invalidateQueries({ queryKey: ['optimized-route'] }); await queryClient.invalidateQueries({ queryKey: ['bins'] }) } })
  const requestCollectionMutation = useMutation({ mutationFn: api.requestCollection, onMutate: (binId: string) => { setRequestPendingId(binId); setRequestFeedback(null) }, onSuccess: async (_result, binId) => { setRequestFeedback({ binId, message: 'Collection request sent to the operations team.', error: false }); await queryClient.invalidateQueries({ queryKey: ['dispatch'] }); await queryClient.invalidateQueries({ queryKey: ['optimized-route'] }) }, onError: (error: Error, binId) => setRequestFeedback({ binId, message: error.message, error: true }), onSettled: () => setRequestPendingId(null) })
  const roleMutation = useMutation({
    mutationFn: ({ id, nextRole }: { id: string; nextRole: Role }) => api.updateUserRole(id, nextRole),
    onMutate: ({ id }) => setRoleFeedback({ userId: id, message: 'Updating role…', error: false }),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setRoleFeedback({ userId: variables.id, message: 'Role updated.', error: false })
    },
    onError: async (error: Error, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setRoleFeedback({ userId: variables.id, message: error.message, error: true })
    },
  })
  const collectorMutation = useMutation({ mutationFn: api.createCollector, onSuccess: async () => { setModal(null); setModalMessage(''); await queryClient.invalidateQueries({ queryKey: ['admin-users'] }) }, onError: (error: Error) => setModalMessage(error.message) })

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours()
      setGreeting(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening')
    }
    updateGreeting()
    const timer = window.setInterval(updateGreeting, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!notificationOpen) return
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) setNotificationOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress)
  }, [notificationOpen])

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

  const bins = binsQuery.data ?? []
  const dispatch = dispatchQuery.data ?? []
  const filteredBins = useMemo(() => bins.filter((bin) => `${bin.bin_id} ${bin.name ?? binNames[bin.bin_id] ?? ''} ${bin.address ?? ''} ${bin.owner_name ?? ''}`.toLowerCase().includes(search.toLowerCase())), [bins, search])
  const average = bins.length ? Math.round(bins.reduce((sum, bin) => sum + bin.fill_level, 0) / bins.length) : 0
  const urgent = bins.filter((bin) => bin.fill_level >= 80).length
  const visibleNav = navItems.filter((item) => item.roles.some((allowedRole) => allowedRole === role))
  const titles: Record<View, { eyebrow: string; title: string; description: string }> = {
    overview: { eyebrow: roleLabel(role), title: `${greeting}, ${sessionQuery.data?.user.name.split(' ')[0] ?? ''}`.trim(), description: role === 'customer' ? 'Here is what is happening across your connected bins.' : role === 'collector' ? 'Monitor fleet health and keep collection routes moving.' : 'Manage the connected fleet, people, and collection operations.' },
    bins: { eyebrow: role === 'customer' ? 'Your devices' : 'Fleet inventory', title: role === 'customer' ? 'Your smart bins' : 'Smart bin fleet', description: role === 'customer' ? 'Monitor connected bins and link devices registered by an administrator.' : role === 'collector' ? 'View bin status and telemetry. Device registration is restricted to administrators.' : 'Manage registered devices, customer ownership, and telemetry health.' },
    dispatch: { eyebrow: role === 'customer' ? 'Your requests' : 'Operations queue', title: role === 'customer' ? 'Collection requests' : 'Collection dispatch', description: role === 'customer' ? 'Track when your bins need collection.' : 'Turn AI-prioritized fill alerts into efficient field routes.' },
    ai: { eyebrow: 'Prediction centre', title: 'AI insights', description: 'See how SmartBin turns sensor telemetry into practical collection decisions.' },
    admin: { eyebrow: 'Platform control', title: 'Administration', description: 'Manage people, roles, collectors, and the device inventory.' },
    profile: { eyebrow: 'Account', title: 'Profile and access', description: 'Manage your personal details, password, and account access.' },
  }

  function submitAuth(event: FormEvent<HTMLFormElement>, mode: 'signin' | 'signup') { event.preventDefault(); const form = new FormData(event.currentTarget); setAuthMessage(''); authMutation.mutate({ mode, name: String(form.get('name') ?? ''), email: String(form.get('email') ?? ''), password: String(form.get('password') ?? '') }) }
  function submitModal(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setModalMessage(''); if (modal === 'collector') { collectorMutation.mutate({ name: String(form.get('name') ?? '').trim(), email: String(form.get('email') ?? '').trim(), password: String(form.get('password') ?? '') }); return } const id = String(form.get('bin_id') ?? '').trim(); const code = String(form.get('claim_code') ?? '').trim(); if (modal === 'register') { const latitude = String(form.get('latitude') ?? '').trim(); const longitude = String(form.get('longitude') ?? '').trim(); registerMutation.mutate({ bin_id: id, claim_code: code, name: String(form.get('name') ?? '').trim(), address: String(form.get('address') ?? '').trim(), latitude: latitude ? Number(latitude) : null, longitude: longitude ? Number(longitude) : null }); return } claimMutation.mutate({ id, code }) }
  async function refresh() {
    if (refreshing) return
    setRefreshing(true)
    try {
      const requests = [queryClient.invalidateQueries({ queryKey: ['bins'] }), queryClient.invalidateQueries({ queryKey: ['dispatch'] })]
      if (role === 'collector' || role === 'superadmin') requests.push(queryClient.invalidateQueries({ queryKey: ['optimized-route'] }))
      if (role === 'superadmin') requests.push(queryClient.invalidateQueries({ queryKey: ['admin-users'] }))
      await Promise.all(requests)
    } finally {
      setRefreshing(false)
    }
  }

  if (sessionQuery.isLoading) return <main className="grid min-h-screen place-items-center bg-[#f4f7fb]"><RefreshCw className="animate-spin text-cyan-600" /></main>
  if (!signedIn) return <AuthGate onSubmit={submitAuth} loading={authMutation.isPending} message={authMessage} />
  const currentUser = sessionQuery.data?.user
  if (!currentUser) return <AuthGate onSubmit={submitAuth} loading={authMutation.isPending} message={authMessage} />

  // The auth gate above guarantees a session before this client-only dashboard renders.
  return (
    <div className="min-h-[100dvh] bg-[#f4f7fb] text-[#152236]">
      <aside id="dashboard-navigation" aria-label="Main navigation" aria-modal={menuOpen ? true : undefined} className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-y-auto overscroll-contain rounded-r-2xl bg-[#111c2d] px-4 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-white shadow-[14px_0_34px_rgba(15,23,42,0.18)] transition-transform lg:rounded-none lg:shadow-none lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-3"><Brand /><button type="button" className="ml-auto grid size-9 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
        <nav className="mt-10 space-y-1">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
          {visibleNav.slice(0, 4).map(({ icon: Icon, label, href, view: itemView }) => <Link key={label} href={href} onClick={() => setMenuOpen(false)} aria-current={view === itemView ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${view === itemView ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><Icon size={17} /><span>{label}</span>{label === 'Dispatch' && dispatch.length > 0 && <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-[#111c2d]">{dispatch.length}</span>}</Link>)}
          {role === 'superadmin' && <Link href="/admin" onClick={() => setMenuOpen(false)} aria-current={view === 'admin' ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${view === 'admin' ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><UserCog size={17} /><span>Administration</span></Link>}
        </nav>
        <div className="mt-8 space-y-1">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Account</p>
          <Link href="/profile" onClick={() => setMenuOpen(false)} aria-current={view === 'profile' ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${view === 'profile' ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><Settings2 size={17} />Profile and access</Link>
          <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 hover:bg-white/5 hover:text-white"><CircleHelp size={17} />Help centre</button>
        </div>
      </aside>
      {menuOpen && <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 bg-[#0f172a]/55 backdrop-blur-[1px] lg:hidden" onClick={() => setMenuOpen(false)} />}
      <main className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-[#dde5ef] bg-white/95 px-4 py-3 shadow-[0_2px_12px_rgba(21,34,54,0.035)] backdrop-blur-md sm:px-8 sm:py-3.5">
          <div className="mx-auto flex max-w-[1400px] items-center gap-2.5 sm:gap-4">
            <button type="button" className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#d7e0eb] bg-white text-[#34445a] shadow-sm transition hover:border-[#b9e2de] hover:bg-[#f8fbfb] lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-controls="dashboard-navigation" aria-expanded={menuOpen}><Menu size={20} /></button>
            <div className="min-w-0 flex-1"><div className="hidden min-w-0 items-center gap-2 text-sm text-[#7a899c] sm:flex"><span className="shrink-0">Workspace</span><ChevronRight size={14} className="shrink-0" /><span className="truncate font-medium text-[#34445a]">{titles[view].title}</span></div><p className="truncate text-sm font-semibold text-[#152236] sm:hidden">{titles[view].title}</p></div>
            {view !== 'admin' && view !== 'profile' && <div className="hidden items-center gap-2 rounded-xl border border-[#d7e0eb] bg-white px-3 py-2 text-sm text-[#7a899c] md:flex"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search bins" className="w-28 bg-transparent outline-none placeholder:text-[#9aa7b7]" /></div>}
            <div ref={notificationRef} className="relative">
              <button type="button" onClick={() => setNotificationOpen(!notificationOpen)} className="relative grid size-10 place-items-center rounded-xl border border-[#b9e2de] bg-[#f1f8f7] text-[#155e5a] transition hover:bg-[#e4f4f2]" aria-label={`Notifications${dispatch.length ? `, ${dispatch.length} unread` : ''}`} aria-expanded={notificationOpen}><Bell size={18} />{dispatch.length > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-amber-400 px-1 py-0.5 text-[9px] font-bold text-[#111c2d]">{dispatch.length > 9 ? '9+' : dispatch.length}</span>}</button>
              {notificationOpen && <div className="absolute right-0 z-20 mt-2 w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#dde5ef] bg-white shadow-xl"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><p className="font-semibold text-[#152236]">Notifications</p><p className="mt-0.5 text-xs text-[#7a899c]">Live collection alerts</p></div><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">{dispatch.length} open</span></div>{dispatch.length ? <div className="max-h-80 overflow-y-auto">{dispatch.slice(0, 6).map((task) => <Link key={task.id} href={`/dispatch#dispatch-${task.id}`} onClick={() => setNotificationOpen(false)} className="block border-b border-slate-100 px-4 py-3 hover:bg-slate-50"><div className="flex items-start gap-3"><div className="mt-0.5 rounded-lg bg-amber-50 p-2 text-amber-600"><Truck size={15} /></div><div className="min-w-0"><p className="text-sm font-medium text-[#152236]">{task.bin_name || binNames[task.bin_id] || task.bin_id} needs collection</p><p className="mt-1 text-xs leading-5 text-[#68788d]">{task.reason}</p><p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">{task.priority} priority</p></div></div></Link>)}</div> : <div className="px-4 py-8 text-center"><CheckCircle2 className="mx-auto text-cyan-600" size={22} /><p className="mt-2 text-sm font-medium text-[#152236]">You’re all caught up</p><p className="mt-1 text-xs text-[#7a899c]">New collection alerts will appear here.</p></div>}<Link href="/dispatch" onClick={() => setNotificationOpen(false)} className="block border-t border-slate-100 px-4 py-3 text-center text-xs font-semibold text-cyan-700 hover:bg-slate-50">Open collection dispatch</Link></div>}
            </div>
            <div className="relative">
              <button type="button" onClick={() => setAccountOpen(!accountOpen)} className="flex h-10 items-center gap-2 rounded-xl border border-[#d7e0eb] bg-white p-1 pr-2.5 shadow-sm transition hover:border-[#b9e2de] sm:pr-3" aria-expanded={accountOpen}><div className="grid size-8 place-items-center rounded-lg bg-[#e4f4f2] text-sm font-semibold text-[#155e5a]">{nameInitials(currentUser.name)}</div><span className="hidden text-sm font-medium text-[#34445a] sm:inline">{roleLabel(role)}</span></button>
              {accountOpen && <div className="absolute right-0 mt-2 w-60 rounded-xl border border-[#dde5ef] bg-white p-2 text-sm shadow-xl"><div className="border-b border-slate-100 px-3 py-2"><p className="font-medium text-[#152236]">{currentUser.name}</p><p className="mt-1 truncate text-xs text-[#68788d]">{currentUser.email}</p></div><Link href="/profile" onClick={() => setAccountOpen(false)} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[#516176] hover:bg-slate-50"><Settings2 size={15} />Profile settings</Link><button type="button" onClick={() => signOutMutation.mutate()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[#516176] hover:bg-slate-50"><LogOut size={15} />Sign out</button></div>}
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">
          <PageTitle {...titles[view]} action={<div className="flex flex-wrap gap-2">{view !== 'profile' && <button type="button" onClick={refresh} disabled={refreshing} aria-busy={refreshing} className="flex items-center gap-2 rounded-xl border border-[#d7e0eb] bg-white px-4 py-2.5 text-sm font-semibold text-[#34445a] shadow-sm hover:border-cyan-300 disabled:cursor-wait disabled:opacity-60"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />{refreshing ? 'Refreshing…' : 'Refresh'}</button>}{view === 'bins' && role === 'customer' && <button type="button" onClick={() => { setModalMessage(''); setModal('claim') }} className="flex items-center gap-2 rounded-xl bg-[#152236] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#23344a]"><Plus size={17} />Link a bin</button>}{view === 'bins' && role === 'superadmin' && <button type="button" onClick={() => { setModalMessage(''); setModal('register') }} className="flex items-center gap-2 rounded-xl bg-[#152236] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#23344a]"><Plus size={17} />Register device</button>}{view === 'admin' && role === 'superadmin' && <button type="button" onClick={() => { setModalMessage(''); setModal('collector') }} className="flex items-center gap-2 rounded-xl bg-[#152236] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#23344a]"><Plus size={17} />Add collector</button>}</div>} />
          {modal === 'collector' ? <AddCollectorModal onClose={() => setModal(null)} onSubmit={submitModal} loading={collectorMutation.isPending} message={modalMessage} /> : modal ? <LinkBinModal admin={modal === 'register'} onClose={() => setModal(null)} onSubmit={submitModal} loading={claimMutation.isPending || registerMutation.isPending} message={modalMessage} /> : null}
          <div className="mt-6 sm:mt-8">
            {view === 'overview' && <OverviewScreen bins={bins} dispatch={dispatch} average={average} urgent={urgent} role={role} onRegister={() => { setModalMessage(''); setModal('register') }} />}
            {view === 'bins' && <BinsScreen bins={filteredBins} dispatch={dispatch} role={role} onLink={() => { setModalMessage(''); setModal('claim') }} onRegister={() => { setModalMessage(''); setModal('register') }} onRequestCollection={(binId) => requestCollectionMutation.mutate(binId)} requestPendingId={requestPendingId} requestFeedback={requestFeedback} />}
            {view === 'dispatch' && <DispatchScreen dispatch={dispatch} bins={bins} role={role} route={routeQuery.data} routeLoading={routeQuery.isLoading} onClose={(id) => closeMutation.mutate(id)} />}
            {view === 'ai' && <AiScreen bins={bins} urgent={urgent} average={average} />}
            {view === 'admin' && role === 'superadmin' && <AdminScreen users={usersQuery.data ?? []} currentUserId={currentUser.id} pendingUserId={roleMutation.isPending ? roleMutation.variables?.id ?? null : null} roleFeedback={roleFeedback} onRoleChange={(id, nextRole) => roleMutation.mutate({ id, nextRole })} />}
            {view === 'profile' && <ProfileScreen user={currentUser} />}
          </div>
        </div>
      </main>
    </div>
  )
}
