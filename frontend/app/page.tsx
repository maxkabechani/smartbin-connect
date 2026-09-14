'use client'

import type { FormEvent, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity, AlertTriangle, Bell, Bot, CheckCircle2, ChevronRight, CircleHelp, Cloud,
  Droplets, Gauge, LogOut, Menu, PackageCheck, Plus, Radio, RefreshCw, Route,
  KeyRound, Search, Settings2, ShieldCheck, Sparkles, Truck, UserCog, UserRound, Users, Wifi, X,
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
  return role === 'superadmin' ? 'Superadmin' : role === 'collector' ? 'Collector' : 'Customer'
}

function lastSeen(value?: string | null) {
  if (!value) return { label: 'No telemetry yet', online: false }
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000))
  return { label: minutes < 1 ? 'Just now' : `${minutes} min ago`, online: minutes <= 30 }
}

function FillBar({ level }: { level: number }) {
  const color = level >= 80 ? 'bg-amber-500' : level >= 60 ? 'bg-amber-300' : 'bg-cyan-500'
  return <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(100, Math.max(0, level))}%` }} /></div>
}

function StatCard({ label, value, detail, icon: Icon, tone = 'cyan' }: { label: string; value: string; detail: string; icon: typeof Activity; tone?: 'cyan' | 'amber' | 'slate' }) {
  const toneClass = tone === 'amber' ? 'bg-amber-50 text-amber-600' : tone === 'slate' ? 'bg-slate-100 text-slate-600' : 'bg-cyan-50 text-cyan-700'
  return <div className="rounded-2xl border border-[#dde5ef] bg-white p-5 shadow-[0_12px_32px_rgba(21,34,54,0.05)]"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-[#68788d]">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight text-[#152236]">{value}</p></div><div className={`rounded-xl p-3 ${toneClass}`}><Icon size={20} /></div></div><p className="mt-3 text-xs text-[#7a899c]">{detail}</p></div>
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-700"><span className="size-2 rounded-full bg-cyan-500" />{eyebrow}</p><h1 className="text-3xl font-semibold tracking-tight text-[#152236] sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-[#68788d]">{description}</p></div>{action && <div className="flex gap-2">{action}</div>}</div>
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

function OverviewScreen({ bins, dispatch, average, urgent, role }: { bins: Bin[]; dispatch: Dispatch[]; average: number; urgent: number; role: Role }) {
  const scope = role === 'customer' ? 'your connected bins' : role === 'collector' ? 'the collection fleet' : 'the complete SmartBin network'
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Tracked bins" value={String(bins.length)} detail={`Visible across ${scope}`} icon={PackageCheck} /><StatCard label="Average fill level" value={`${average}%`} detail="Across active telemetry" icon={Droplets} /><StatCard label="Needs attention" value={String(urgent)} detail={urgent ? 'Collection recommended' : 'Everything is healthy'} icon={AlertTriangle} tone="amber" /><StatCard label="Open dispatch" value={String(dispatch.length)} detail="AI-prioritized collection tasks" icon={Truck} tone="slate" /></div>{bins.length ? <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]"><section className="rounded-2xl border border-[#dde5ef] bg-white p-5 shadow-[0_12px_32px_rgba(21,34,54,0.05)] sm:p-6"><div className="flex items-start justify-between"><div><h2 className="font-semibold text-[#152236]">Network overview</h2><p className="mt-1 text-sm text-[#68788d]">Latest fill levels from registered devices</p></div><Activity size={19} className="text-cyan-600" /></div><div className="mt-8 flex h-52 items-end gap-3 border-b border-l border-slate-100 px-3 pb-0 pt-4 sm:gap-5">{bins.map((bin) => <div key={bin.bin_id} className="group relative flex h-full flex-1 items-end"><div className={`w-full rounded-t-lg ${bin.fill_level >= 80 ? 'bg-amber-500' : bin.fill_level >= 60 ? 'bg-amber-300' : 'bg-cyan-400'}`} style={{ height: `${Math.max(12, bin.fill_level)}%` }} /><span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium text-[#68788d] opacity-0 transition group-hover:opacity-100">{Math.round(bin.fill_level)}%</span><span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[11px] text-[#7a899c]">{bin.bin_id.replace('BIN-', '#')}</span></div>)}</div></section><section className="rounded-2xl border border-[#23344a] bg-[#142439] p-5 text-white shadow-[0_16px_40px_rgba(20,36,57,0.16)] sm:p-6"><div className="flex items-center gap-2"><div className="rounded-lg bg-cyan-400/15 p-2 text-cyan-300"><Sparkles size={18} /></div><h2 className="font-semibold">AI operations brief</h2></div><p className="mt-5 text-sm leading-6 text-slate-300">{urgent ? `${urgent} ${urgent === 1 ? 'bin is' : 'bins are'} approaching capacity and should be routed soon.` : 'The network is stable. No immediate collection action is required.'}</p><div className="mt-6 space-y-3"><div className="flex items-center gap-3 rounded-xl bg-white/8 p-3"><div className="rounded-lg bg-amber-400/15 p-2 text-amber-300"><Truck size={16} /></div><div className="flex-1"><p className="text-sm font-medium">Route suggestions</p><p className="text-xs text-slate-400">Prioritized from live fill readings</p></div><ChevronRight size={16} className="text-slate-500" /></div><div className="flex items-center gap-3 rounded-xl bg-white/8 p-3"><div className="rounded-lg bg-cyan-400/15 p-2 text-cyan-300"><Wifi size={16} /></div><div className="flex-1"><p className="text-sm font-medium">Telemetry protection</p><p className="text-xs text-slate-400">Updates refresh every 30 seconds</p></div><CheckCircle2 size={16} className="text-cyan-300" /></div></div></section></div> : <EmptyState title="No bins are connected yet" description={role === 'customer' ? 'Link your first SmartBin to start receiving live telemetry.' : 'Registered devices will appear here as they begin sending telemetry.'} />}</div>
}

function BinsScreen({ bins, role, onLink, onRegister }: { bins: Bin[]; role: Role; onLink: () => void; onRegister: () => void }) {
  const canLink = role === 'customer'
  const canRegister = role === 'superadmin'
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Registered bins" value={String(bins.length)} detail={role === 'customer' ? 'Linked to your account' : 'Registered in the fleet'} icon={PackageCheck} /><StatCard label="Online now" value={String(bins.filter((bin) => lastSeen(bin.last_seen).online).length)} detail="Last check-in within 30 minutes" icon={Wifi} /><StatCard label="Average fill" value={`${bins.length ? Math.round(bins.reduce((sum, bin) => sum + bin.fill_level, 0) / bins.length) : 0}%`} detail="Across visible telemetry" icon={Droplets} /></div><section className="rounded-2xl border border-[#dde5ef] bg-white p-5 shadow-[0_12px_32px_rgba(21,34,54,0.05)] sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="font-semibold text-[#152236]">{role === 'customer' ? 'Your connected bins' : 'Fleet inventory'}</h2><p className="mt-1 text-sm text-[#68788d]">Live device status and fill levels</p></div>{canLink && <button onClick={onLink} className="flex items-center justify-center gap-2 rounded-xl bg-[#152236] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#23344a]"><Plus size={16} />Link a bin</button>}{canRegister && <button onClick={onRegister} className="flex items-center justify-center gap-2 rounded-xl bg-[#152236] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#23344a]"><Plus size={16} />Register device</button>}</div>{bins.length ? <div className="mt-6 space-y-3">{bins.map((bin) => { const status = lastSeen(bin.last_seen); return <div key={bin.bin_id} className="rounded-xl border border-[#e4eaf2] p-4 transition hover:border-cyan-300 hover:shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className={`grid size-11 place-items-center rounded-xl ${bin.fill_level >= 80 ? 'bg-amber-50 text-amber-700' : 'bg-cyan-50 text-cyan-700'}`}><PackageCheck size={20} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-[#152236]">{binNames[bin.bin_id] ?? bin.bin_id}</p><span className="text-xs text-[#7a899c]">{bin.bin_id}</span></div><p className="mt-1 flex items-center gap-1.5 text-xs text-[#7a899c]"><Radio size={12} className={status.online ? 'text-cyan-600' : 'text-slate-400'} />{status.online ? 'Online' : 'Offline'} · {status.label}</p>{role !== 'customer' && <p className="mt-1 text-xs text-[#68788d]">Owner: {bin.owner_name ?? 'Unassigned'}{bin.owner_email ? ` · ${bin.owner_email}` : ''}</p>}</div><div className="w-full sm:w-48"><div className="mb-2 flex items-center justify-between text-xs"><span className="text-[#7a899c]">Capacity used</span><span className={`font-semibold ${bin.fill_level >= 80 ? 'text-amber-700' : 'text-[#152236]'}`}>{Math.round(bin.fill_level)}%</span></div><FillBar level={bin.fill_level} /></div></div></div>})}</div> : <div className="mt-7"><EmptyState title={role === 'customer' ? 'No connected bins yet' : 'No registered devices yet'} description={role === 'customer' ? 'Use the button above and enter the claim details supplied with your bin.' : 'Register a device before it can send telemetry to the platform.'} /></div>}</section></div>
}

function DispatchScreen({ dispatch, role, onClose, route, routeLoading }: { dispatch: Dispatch[]; role: Role; onClose: (id: number) => void; route?: OptimizedRoute; routeLoading: boolean }) {
  const operational = role === 'collector' || role === 'superadmin'

  return <div className="space-y-6">
    {operational && <section className="rounded-2xl border border-[#23344a] bg-[#142439] p-5 text-white shadow-[0_16px_40px_rgba(20,36,57,0.16)] sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2 text-cyan-300"><Route size={18} /><p className="text-sm font-semibold">AI-optimized collection route</p></div>
          <h2 className="mt-2 text-2xl font-semibold">Today’s recommended run</h2>
          <p className="mt-1 text-sm text-slate-400">Priority, bin capacity, and location are combined into one stop order.</p>
        </div>
        <span className="w-fit rounded-full bg-cyan-400/15 px-3 py-1.5 text-xs font-semibold text-cyan-200">{route?.stops.length ? 'Route ready' : 'No route required'}</span>
      </div>
      {routeLoading ? <div className="mt-6 flex items-center gap-2 rounded-xl bg-white/8 p-4 text-sm text-slate-300"><RefreshCw size={16} className="animate-spin text-cyan-300" />Building the best stop order…</div> : route?.stops.length ? <>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-white/8 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Stops</p><p className="mt-2 text-2xl font-semibold">{route.stops.length}</p></div>
          <div className="rounded-xl bg-white/8 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Total trip</p><p className="mt-2 text-2xl font-semibold">{route.total_distance_km.toFixed(1)} km</p><p className="mt-1 text-xs text-slate-500">Round trip to site</p></div>
          <div className="rounded-xl bg-white/8 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">To first bin</p><p className="mt-2 text-2xl font-semibold">{route.distance_to_first_km.toFixed(1)} km</p><p className="mt-1 text-xs text-slate-500">From disposal site</p></div>
          <div className="rounded-xl bg-white/8 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Return to site</p><p className="mt-2 text-2xl font-semibold">{route.return_distance_km.toFixed(1)} km</p><p className="mt-1 text-xs text-slate-500">After final collection · {route.estimated_minutes} min total</p></div>
        </div>
        <div className="mt-6 space-y-3">{route.stops.map((stop) => <div key={stop.bin_id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-cyan-400/15 text-sm font-semibold text-cyan-200">{stop.sequence}</div>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{binNames[stop.bin_id] ?? stop.bin_id}</p><span className="text-xs text-slate-500">{stop.bin_id}</span></div><p className="mt-1 text-xs text-slate-400">{stop.owner_name ? `${stop.owner_name} · ` : ''}{stop.reason}{stop.location_available ? ` · ${stop.distance_from_previous_km.toFixed(1)} km from previous` : ' · location needed'}</p></div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${stop.priority === 'urgent' ? 'bg-rose-400/15 text-rose-200' : 'bg-amber-400/15 text-amber-200'}`}>{stop.priority}</span><span className="text-sm font-semibold text-cyan-200">{Math.round(stop.fill_level)}%</span>
        </div>)}</div>
        {route.unlocated_stops > 0 && <p className="mt-4 text-xs leading-5 text-amber-200">Add coordinates when registering new bins to improve distance estimates. Unlocated stops remain in priority order.</p>}
        <p className="mt-4 text-xs text-slate-500">Outbound route: {route.outbound_distance_km.toFixed(1)} km · Between stops: {route.between_stops_distance_km.toFixed(1)} km · Optimizer: {route.algorithm}{route.estimated_savings_percent ? ` · estimated ${route.estimated_savings_percent}% route saving` : ''}</p>
      </> : <div className="mt-6 rounded-xl border border-dashed border-white/15 p-5 text-sm text-slate-400">No open collection tasks need a route right now.</div>}
    </section>}
    <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Open tasks" value={String(dispatch.length)} detail={role === 'customer' ? 'Your collection requests' : 'Awaiting field collection'} icon={Truck} tone="amber" /><StatCard label="High priority" value={String(dispatch.filter((task) => task.priority === 'high' || task.priority === 'urgent').length)} detail="Should be routed first" icon={AlertTriangle} tone="amber" /><StatCard label="Route efficiency" value={route?.estimated_savings_percent ? `${route.estimated_savings_percent}%` : '—'} detail={operational ? 'Estimated route saving' : 'Available to the collection team'} icon={Route} tone="slate" /></div>
    <section className="rounded-2xl border border-[#dde5ef] bg-white p-5 shadow-[0_12px_32px_rgba(21,34,54,0.05)] sm:p-6"><div><h2 className="font-semibold text-[#152236]">{operational ? 'Operations queue' : 'Collection requests'}</h2><p className="mt-1 text-sm text-[#68788d]">{operational ? 'AI-prioritized tasks ready for route assignment' : 'Track collection tasks created from your bin telemetry'}</p></div>{dispatch.length ? <div className="mt-6 grid gap-3 md:grid-cols-2">{dispatch.map((task) => <div key={task.id} className="rounded-xl border border-amber-200 bg-amber-50/70 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-[#152236]">{binNames[task.bin_id] ?? task.bin_id}</p><p className="mt-1 text-xs text-[#7a899c]">{task.bin_id}{operational && task.owner_name ? ` · ${task.owner_name}` : ''}</p></div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">{task.priority}</span></div><p className="mt-4 text-sm text-[#516176]">{task.reason}</p>{operational ? <button onClick={() => onClose(task.id)} className="mt-4 flex items-center gap-2 text-xs font-semibold text-amber-700 hover:text-amber-900"><CheckCircle2 size={14} />Mark collected</button> : <div className="mt-4 flex items-center gap-2 text-xs font-medium text-amber-700"><Truck size={14} />Awaiting collection</div>}</div>)}</div> : <div className="mt-7"><EmptyState title="No open collection tasks" description="Your network is being monitored continuously. New priority tasks will appear here automatically." /></div>}<div className="mt-6 flex items-center gap-2 rounded-xl border border-dashed border-[#d7e0eb] p-3 text-xs text-[#68788d]"><Cloud size={15} className="text-cyan-600" />Telemetry is synced automatically every 30 seconds</div></section>
  </div>
}

function AiScreen({ bins, urgent, average }: { bins: Bin[]; urgent: number; average: number }) {
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Prediction model" value="Online" detail="Hugging Face model loaded" icon={Bot} /><StatCard label="Signals analysed" value={String(bins.length)} detail="Latest bin readings" icon={Activity} /><StatCard label="Fleet forecast" value={urgent ? 'Action' : 'Stable'} detail={`${average}% average capacity used`} icon={Sparkles} tone={urgent ? 'amber' : 'cyan'} /></div><div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><section className="rounded-2xl border border-[#23344a] bg-[#142439] p-6 text-white shadow-[0_16px_40px_rgba(20,36,57,0.16)]"><div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-400/15 p-3 text-cyan-300"><Sparkles size={22} /></div><div><p className="text-sm font-semibold text-cyan-300">SmartBin prediction pipeline</p><h2 className="mt-1 text-2xl font-semibold">From sensor reading to route decision</h2></div></div><div className="mt-8 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-white/8 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">01 · Device</p><p className="mt-2 text-sm font-medium">ESP32 telemetry</p><p className="mt-1 text-xs leading-5 text-slate-400">Ultrasonic fill level, Wi-Fi signal, and lid status.</p></div><div className="rounded-xl bg-white/8 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">02 · Model</p><p className="mt-2 text-sm font-medium">Hugging Face predictor</p><p className="mt-1 text-xs leading-5 text-slate-400">Estimates time until capacity using learned patterns.</p></div><div className="rounded-xl bg-white/8 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">03 · Action</p><p className="mt-2 text-sm font-medium">Dispatch priority</p><p className="mt-1 text-xs leading-5 text-slate-400">Creates a collection task when a bin needs attention.</p></div></div></section><section className="rounded-2xl border border-[#dde5ef] bg-white p-6 shadow-[0_12px_32px_rgba(21,34,54,0.05)]"><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-cyan-700" /><h2 className="font-semibold text-[#152236]">Model status</h2></div><div className="mt-6 space-y-4 text-sm"><div className="flex items-center justify-between border-b border-slate-100 pb-4"><span className="text-[#68788d]">Repository</span><span className="font-medium text-[#152236]">smartbin-fill-predictor</span></div><div className="flex items-center justify-between border-b border-slate-100 pb-4"><span className="text-[#68788d]">Runtime</span><span className="font-medium text-cyan-700">FastAPI · ready</span></div><div className="flex items-center justify-between"><span className="text-[#68788d]">Fallback</span><span className="font-medium text-[#152236]">Explainable rule set</span></div></div></section></div></div>
}

function AdminScreen({ users, currentUserId, onRoleChange }: { users: AppUser[]; currentUserId: string; onRoleChange: (id: string, role: Role) => void }) {
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Accounts" value={String(users.length)} detail="Registered platform users" icon={Users} /><StatCard label="Collectors" value={String(users.filter((item) => item.role === 'collector').length)} detail="Field operations staff" icon={Truck} tone="slate" /><StatCard label="Customers" value={String(users.filter((item) => item.role === 'customer').length)} detail="Bin owners and tenants" icon={PackageCheck} /></div><section className="rounded-2xl border border-[#dde5ef] bg-white p-5 shadow-[0_12px_32px_rgba(21,34,54,0.05)] sm:p-6"><div><h2 className="font-semibold text-[#152236]">User access</h2><p className="mt-1 text-sm text-[#68788d]">Assign the least-privileged role each person needs.</p></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#7a899c]"><th className="px-3 py-3 font-semibold">Person</th><th className="px-3 py-3 font-semibold">Email</th><th className="px-3 py-3 font-semibold">Role</th><th className="px-3 py-3 font-semibold">Access</th></tr></thead><tbody>{users.map((item) => <tr key={item.id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-4 font-medium text-[#152236]">{item.name}{item.id === currentUserId && <span className="ml-2 rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-semibold text-cyan-700">You</span>}</td><td className="px-3 py-4 text-[#68788d]">{item.email}</td><td className="px-3 py-4"><select disabled={item.id === currentUserId} value={item.role} onChange={(event) => onRoleChange(item.id, event.target.value as Role)} className="rounded-lg border border-[#d7e0eb] bg-white px-2.5 py-2 text-sm text-[#34445a]"><option value="customer">Customer</option><option value="collector">Collector</option><option value="superadmin">Superadmin</option></select></td><td className="px-3 py-4 text-xs text-[#68788d]">{item.role === 'superadmin' ? 'Full platform control' : item.role === 'collector' ? 'Fleet and dispatch operations' : 'Own bins and collection requests'}</td></tr>)}</tbody></table>{!users.length && <EmptyState title="No accounts found" description="New accounts will appear here after registration." />}</div></section></div>
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

  const initials = user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return <div className="space-y-6"><section className="rounded-2xl border border-[#23344a] bg-[#142439] p-6 text-white shadow-[0_16px_40px_rgba(20,36,57,0.16)]"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-cyan-400/15 text-xl font-semibold text-cyan-200">{initials}</div><div><p className="text-sm font-semibold text-cyan-300">Account profile</p><h2 className="mt-1 text-2xl font-semibold">{user.name}</h2><div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300"><span>{user.email}</span><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">{roleLabel(user.role)}</span></div></div></div></section><div className="grid gap-5 xl:grid-cols-2"><section className="rounded-2xl border border-[#dde5ef] bg-white p-5 shadow-[0_12px_32px_rgba(21,34,54,0.05)] sm:p-6"><div className="flex items-start gap-3"><div className="rounded-xl bg-cyan-50 p-3 text-cyan-700"><UserRound size={19} /></div><div><h2 className="font-semibold text-[#152236]">Personal details</h2><p className="mt-1 text-sm text-[#68788d]">Keep the name shown across your workspace up to date.</p></div></div><form onSubmit={saveProfile} className="mt-6 space-y-4"><label className="block text-sm font-medium text-[#34445a]">Display name<input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label><label className="block text-sm font-medium text-[#34445a]">Email address<input value={user.email} readOnly aria-describedby="email-note" className="mt-2 w-full cursor-not-allowed rounded-xl border border-[#d7e0eb] bg-slate-50 px-3 py-2.5 text-[#68788d] outline-none" /></label><p id="email-note" className="text-xs leading-5 text-[#7a899c]">Your email is used for sign-in and cannot be changed from this screen.</p>{profileMessage && <p role="alert" className={`rounded-xl border px-3 py-2.5 text-sm ${profileSuccess ? 'border-cyan-200 bg-cyan-50 text-cyan-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{profileMessage}</p>}<button disabled={profileMutation.isPending} className="flex items-center justify-center gap-2 rounded-xl bg-[#152236] px-4 py-3 text-sm font-semibold text-white hover:bg-[#23344a] disabled:opacity-60">{profileMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Settings2 size={16} />}Save profile</button></form></section><section className="rounded-2xl border border-[#dde5ef] bg-white p-5 shadow-[0_12px_32px_rgba(21,34,54,0.05)] sm:p-6"><div className="flex items-start gap-3"><div className="rounded-xl bg-cyan-50 p-3 text-cyan-700"><KeyRound size={19} /></div><div><h2 className="font-semibold text-[#152236]">Password and security</h2><p className="mt-1 text-sm text-[#68788d]">Change your password without leaving the dashboard.</p></div></div><form onSubmit={savePassword} className="mt-6 space-y-4"><label className="block text-sm font-medium text-[#34445a]">Current password<input value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required type="password" autoComplete="current-password" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label><label className="block text-sm font-medium text-[#34445a]">New password<input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={8} type="password" autoComplete="new-password" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label><label className="block text-sm font-medium text-[#34445a]">Confirm new password<input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} type="password" autoComplete="new-password" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label>{passwordMessage && <p role="alert" className={`rounded-xl border px-3 py-2.5 text-sm ${passwordSuccess ? 'border-cyan-200 bg-cyan-50 text-cyan-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{passwordMessage}</p>}<button disabled={passwordMutation.isPending} className="flex items-center justify-center gap-2 rounded-xl bg-[#152236] px-4 py-3 text-sm font-semibold text-white hover:bg-[#23344a] disabled:opacity-60">{passwordMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <KeyRound size={16} />}Change password</button></form></section></div></div>
}

function AddCollectorModal({ onClose, onSubmit, loading, message }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; loading: boolean; message: string }) {
  return <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-[#0f172a]/40 px-4 py-6"><div className="w-full max-w-md rounded-2xl border border-[#dde5ef] bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-cyan-700">Platform access</p><h2 className="mt-1 text-lg font-semibold text-[#152236]">Add a collector</h2><p className="mt-1 text-sm text-[#68788d]">Create a field-operations account for the dispatch queue.</p></div><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><X size={18} /></button></div><form onSubmit={onSubmit} className="mt-6 space-y-4"><label className="block text-sm font-medium text-[#34445a]">Full name<input required name="name" placeholder="Collector name" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label><label className="block text-sm font-medium text-[#34445a]">Email address<input required type="email" name="email" placeholder="collector@example.com" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label><label className="block text-sm font-medium text-[#34445a]">Temporary password<input required minLength={8} type="password" name="password" placeholder="At least 8 characters" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label><p className="text-xs leading-5 text-[#7a899c]">Share the temporary password securely. The collector can change it from Profile and access.</p>{message && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">{message}</p>}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl border border-[#d7e0eb] px-4 py-3 text-sm font-semibold text-[#516176] hover:bg-slate-50">Cancel</button><button disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-[#152236] px-4 py-3 text-sm font-semibold text-white hover:bg-[#23344a] disabled:opacity-60">{loading && <RefreshCw size={16} className="animate-spin" />}Create collector</button></div></form></div></div>
}

function LinkBinModal({ onClose, onSubmit, loading, message, admin = false }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; loading: boolean; message: string; admin?: boolean }) {
  return <div className="fixed inset-0 z-40 grid place-items-center bg-[#0f172a]/40 px-4"><div className="w-full max-w-md rounded-2xl border border-[#dde5ef] bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-[#152236]">{admin ? 'Register a smart bin' : 'Link a smart bin'}</h2><p className="mt-1 text-sm text-[#68788d]">{admin ? 'Register the device before it connects to the platform.' : 'Use the bin ID and claim code supplied with your device.'}</p></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><X size={18} /></button></div><form onSubmit={onSubmit} className="mt-6 space-y-4"><label className="block text-sm font-medium text-[#34445a]">Bin ID<input required name="bin_id" placeholder="BIN-05" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label><label className="block text-sm font-medium text-[#34445a]">Claim code<input required name="claim_code" placeholder="Printed on the device" className="mt-2 w-full rounded-xl border border-[#d7e0eb] px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2" /></label>{message && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p>}<button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#152236] py-3 text-sm font-semibold text-white hover:bg-[#23344a] disabled:opacity-60">{loading && <RefreshCw size={15} className="animate-spin" />}{admin ? 'Register device' : 'Link device'}</button></form></div></div>
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
  const registerMutation = useMutation({ mutationFn: ({ id, code }: { id: string; code: string }) => api.registerBin(id, code), onSuccess: async () => { setModal(null); setModalMessage(''); await queryClient.invalidateQueries({ queryKey: ['bins'] }) }, onError: (error: Error) => setModalMessage(error.message) })
  const closeMutation = useMutation({ mutationFn: api.closeDispatch, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['dispatch'] }); await queryClient.invalidateQueries({ queryKey: ['optimized-route'] }); await queryClient.invalidateQueries({ queryKey: ['bins'] }) } })
  const roleMutation = useMutation({ mutationFn: ({ id, nextRole }: { id: string; nextRole: Role }) => api.updateUserRole(id, nextRole), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin-users'] }) } })
  const collectorMutation = useMutation({ mutationFn: api.createCollector, onSuccess: async () => { setModal(null); setModalMessage(''); await queryClient.invalidateQueries({ queryKey: ['admin-users'] }) }, onError: (error: Error) => setModalMessage(error.message) })

  const bins = binsQuery.data ?? []
  const dispatch = dispatchQuery.data ?? []
  const filteredBins = useMemo(() => bins.filter((bin) => `${bin.bin_id} ${binNames[bin.bin_id] ?? ''} ${bin.owner_name ?? ''}`.toLowerCase().includes(search.toLowerCase())), [bins, search])
  const average = bins.length ? Math.round(bins.reduce((sum, bin) => sum + bin.fill_level, 0) / bins.length) : 0
  const urgent = bins.filter((bin) => bin.fill_level >= 80).length
  const visibleNav = navItems.filter((item) => item.roles.some((allowedRole) => allowedRole === role))
  const titles: Record<View, { eyebrow: string; title: string; description: string }> = {
    overview: { eyebrow: roleLabel(role), title: `Good morning, ${sessionQuery.data?.user.name.split(' ')[0] ?? ''}`.trim(), description: role === 'customer' ? 'Here is what is happening across your connected bins.' : role === 'collector' ? 'Monitor fleet health and keep collection routes moving.' : 'Manage the connected fleet, people, and collection operations.' },
    bins: { eyebrow: role === 'customer' ? 'Your devices' : 'Fleet inventory', title: role === 'customer' ? 'Your smart bins' : 'Smart bin fleet', description: role === 'customer' ? 'Monitor every connected bin and link new devices to your account.' : 'Monitor registered devices, customer ownership, and telemetry health.' },
    dispatch: { eyebrow: role === 'customer' ? 'Your requests' : 'Operations queue', title: role === 'customer' ? 'Collection requests' : 'Collection dispatch', description: role === 'customer' ? 'Track when your bins need collection.' : 'Turn AI-prioritized fill alerts into efficient field routes.' },
    ai: { eyebrow: 'Prediction centre', title: 'AI insights', description: 'See how SmartBin turns sensor telemetry into practical collection decisions.' },
    admin: { eyebrow: 'Platform control', title: 'Administration', description: 'Manage people, roles, collectors, and the device inventory.' },
    profile: { eyebrow: 'Account', title: 'Profile and access', description: 'Manage your personal details, password, and account access.' },
  }

  function submitAuth(event: FormEvent<HTMLFormElement>, mode: 'signin' | 'signup') { event.preventDefault(); const form = new FormData(event.currentTarget); setAuthMessage(''); authMutation.mutate({ mode, name: String(form.get('name') ?? ''), email: String(form.get('email') ?? ''), password: String(form.get('password') ?? '') }) }
  function submitModal(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setModalMessage(''); if (modal === 'collector') { collectorMutation.mutate({ name: String(form.get('name') ?? '').trim(), email: String(form.get('email') ?? '').trim(), password: String(form.get('password') ?? '') }); return } const payload = { id: String(form.get('bin_id') ?? '').trim(), code: String(form.get('claim_code') ?? '').trim() }; if (modal === 'register') registerMutation.mutate(payload); else claimMutation.mutate(payload) }
  function refresh() { queryClient.invalidateQueries({ queryKey: ['bins'] }); queryClient.invalidateQueries({ queryKey: ['dispatch'] }); if (role === 'collector' || role === 'superadmin') queryClient.invalidateQueries({ queryKey: ['optimized-route'] }); if (role === 'superadmin') queryClient.invalidateQueries({ queryKey: ['admin-users'] }) }

  if (sessionQuery.isLoading) return <main className="grid min-h-screen place-items-center bg-[#f4f7fb]"><RefreshCw className="animate-spin text-cyan-600" /></main>
  if (!signedIn) return <AuthGate onSubmit={submitAuth} loading={authMutation.isPending} message={authMessage} />
  const currentUser = sessionQuery.data?.user
  if (!currentUser) return <AuthGate onSubmit={submitAuth} loading={authMutation.isPending} message={authMessage} />

  // The auth gate above guarantees a session before this client-only dashboard renders.
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-[#152236]">
      <aside className={`fixed inset-y-0 left-0 z-30 w-72 border-r border-white/10 bg-[#111c2d] px-4 py-5 text-white transition-transform lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-3"><Brand /><button className="ml-auto lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
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
        <div className="absolute bottom-5 left-4 right-4 rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2 text-xs font-medium text-slate-200"><ShieldCheck size={15} className="text-cyan-300" />Secure workspace</div><p className="mt-2 text-xs leading-5 text-slate-500">Your access is limited to the role assigned to your account.</p></div>
      </aside>
      {menuOpen && <button aria-label="Close menu" className="fixed inset-0 z-20 bg-[#0f172a]/30 lg:hidden" onClick={() => setMenuOpen(false)} />}
      <main className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-[#dde5ef] bg-[#f4f7fb]/90 px-5 py-4 backdrop-blur-md sm:px-8">
          <div className="mx-auto flex max-w-[1400px] items-center gap-4">
            <button className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
            <div className="flex-1"><div className="flex items-center gap-2 text-sm text-[#7a899c]"><span>Workspace</span><ChevronRight size={14} /><span className="font-medium text-[#34445a]">{titles[view].title}</span></div></div>
            {view !== 'admin' && view !== 'profile' && <div className="hidden items-center gap-2 rounded-xl border border-[#d7e0eb] bg-white px-3 py-2 text-sm text-[#7a899c] md:flex"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search bins" className="w-28 bg-transparent outline-none placeholder:text-[#9aa7b7]" /></div>}
            <button type="button" onClick={refresh} className="relative rounded-xl border border-[#d7e0eb] bg-white p-2.5 text-[#516176] hover:border-cyan-300" aria-label="Refresh data"><Bell size={18} /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-amber-400" /></button>
            <div className="relative">
              <button type="button" onClick={() => setAccountOpen(!accountOpen)} className="flex items-center gap-2 rounded-xl border border-[#d7e0eb] bg-white p-1.5 pr-3" aria-expanded={accountOpen}><div className="grid size-8 place-items-center rounded-lg bg-cyan-100 text-sm font-semibold text-cyan-800">{currentUser.name.slice(0, 2).toUpperCase()}</div><span className="hidden text-sm font-medium text-[#34445a] sm:inline">{roleLabel(role)}</span></button>
              {accountOpen && <div className="absolute right-0 mt-2 w-60 rounded-xl border border-[#dde5ef] bg-white p-2 text-sm shadow-xl"><div className="border-b border-slate-100 px-3 py-2"><p className="font-medium text-[#152236]">{currentUser.name}</p><p className="mt-1 truncate text-xs text-[#68788d]">{currentUser.email}</p></div><Link href="/profile" onClick={() => setAccountOpen(false)} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[#516176] hover:bg-slate-50"><Settings2 size={15} />Profile settings</Link><button type="button" onClick={() => signOutMutation.mutate()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[#516176] hover:bg-slate-50"><LogOut size={15} />Sign out</button></div>}
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8">
          <PageTitle {...titles[view]} action={<div className="flex flex-wrap gap-2">{view !== 'profile' && <button type="button" onClick={refresh} className="flex items-center gap-2 rounded-xl border border-[#d7e0eb] bg-white px-4 py-2.5 text-sm font-semibold text-[#34445a] shadow-sm hover:border-cyan-300"><RefreshCw size={16} />Refresh</button>}{view === 'bins' && role === 'customer' && <button type="button" onClick={() => { setModalMessage(''); setModal('claim') }} className="flex items-center gap-2 rounded-xl bg-[#152236] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#23344a]"><Plus size={17} />Link a bin</button>}{view === 'bins' && role === 'superadmin' && <button type="button" onClick={() => { setModalMessage(''); setModal('register') }} className="flex items-center gap-2 rounded-xl bg-[#152236] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#23344a]"><Plus size={17} />Register device</button>}{view === 'admin' && role === 'superadmin' && <button type="button" onClick={() => { setModalMessage(''); setModal('collector') }} className="flex items-center gap-2 rounded-xl bg-[#152236] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#23344a]"><Plus size={17} />Add collector</button>}</div>} />
          {modal === 'collector' ? <AddCollectorModal onClose={() => setModal(null)} onSubmit={submitModal} loading={collectorMutation.isPending} message={modalMessage} /> : modal ? <LinkBinModal admin={modal === 'register'} onClose={() => setModal(null)} onSubmit={submitModal} loading={claimMutation.isPending || registerMutation.isPending} message={modalMessage} /> : null}
          <div className="mt-8">
            {view === 'overview' && <OverviewScreen bins={bins} dispatch={dispatch} average={average} urgent={urgent} role={role} />}
            {view === 'bins' && <BinsScreen bins={filteredBins} role={role} onLink={() => { setModalMessage(''); setModal('claim') }} onRegister={() => { setModalMessage(''); setModal('register') }} />}
            {view === 'dispatch' && <DispatchScreen dispatch={dispatch} role={role} route={routeQuery.data} routeLoading={routeQuery.isLoading} onClose={(id) => closeMutation.mutate(id)} />}
            {view === 'ai' && <AiScreen bins={bins} urgent={urgent} average={average} />}
            {view === 'admin' && role === 'superadmin' && <AdminScreen users={usersQuery.data ?? []} currentUserId={currentUser.id} onRoleChange={(id, nextRole) => roleMutation.mutate({ id, nextRole })} />}
            {view === 'profile' && <ProfileScreen user={currentUser} />}
          </div>
        </div>
      </main>
    </div>
  )
}
