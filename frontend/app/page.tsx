"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Activity, AlertTriangle, Bell, Bot, CheckCircle2, ChevronRight, CircleHelp,
  Cloud, Droplets, Gauge, Leaf, LogOut, Menu, MoreHorizontal, PackageCheck,
  Plus, Radio, RefreshCw, Route, Search, Settings2, ShieldCheck, Sparkles,
  Truck, Wifi, X,
} from "lucide-react"

type Bin = { bin_id: string; name?: string; fill_level: number; priority: string; wifi_rssi?: number; last_seen?: string }
type Dispatch = { id: number; bin_id: string; priority: string; reason: string; status?: string }

const demoBins: Bin[] = [
  { bin_id: "BIN-01", name: "Main entrance", fill_level: 82, priority: "high", wifi_rssi: -54, last_seen: "Just now" },
  { bin_id: "BIN-02", name: "Cafeteria", fill_level: 46, priority: "normal", wifi_rssi: -61, last_seen: "2 min ago" },
  { bin_id: "BIN-03", name: "Workshop", fill_level: 18, priority: "normal", wifi_rssi: -67, last_seen: "5 min ago" },
]

function StatCard({ label, value, detail, icon: Icon, tone = "green" }: { label: string; value: string; detail: string; icon: typeof Activity; tone?: string }) {
  return <div className="rounded-2xl border bg-white p-5 shadow-sm shadow-emerald-950/[0.03]">
    <div className="flex items-start justify-between"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p></div><div className={`rounded-xl p-3 ${tone === "amber" ? "bg-amber-50 text-amber-600" : tone === "blue" ? "bg-sky-50 text-sky-600" : "bg-emerald-50 text-emerald-600"}`}><Icon size={20} /></div></div>
    <p className="mt-3 text-xs text-slate-500">{detail}</p>
  </div>
}

function FillBar({ level }: { level: number }) {
  const color = level >= 80 ? "bg-rose-500" : level >= 60 ? "bg-amber-500" : "bg-emerald-500"
  return <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${level}%` }} /></div>
}

export default function Dashboard() {
  const [bins, setBins] = useState<Bin[]>(demoBins)
  const [dispatch, setDispatch] = useState<Dispatch[]>([])
  const [loading, setLoading] = useState(false)
  const [showLink, setShowLink] = useState(false)
  const [binId, setBinId] = useState("")
  const [claim, setClaim] = useState("")
  const [message, setMessage] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const [binResponse, dispatchResponse] = await Promise.all([fetch("/api/bins", { credentials: "include" }), fetch("/api/dispatch", { credentials: "include" })])
      if (binResponse.ok) setBins(await binResponse.json())
      if (dispatchResponse.ok) setDispatch(await dispatchResponse.json())
    } catch { /* Demo data keeps the dashboard useful before the API is configured. */ }
    finally { setLoading(false) }
  }

  async function linkBin(event: React.FormEvent) {
    event.preventDefault(); setMessage("")
    try {
      const response = await fetch("/api/bins/claim", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ bin_id: binId, claim_code: claim }) })
      setMessage(response.ok ? "Bin linked successfully." : await response.text())
      if (response.ok) { setShowLink(false); setBinId(""); setClaim(""); refresh() }
    } catch { setMessage("The API is not reachable yet. You can still explore the dashboard with demo data.") }
  }

  useEffect(() => { refresh(); const timer = setInterval(refresh, 30000); return () => clearInterval(timer) }, [])
  const average = useMemo(() => bins.length ? Math.round(bins.reduce((sum, bin) => sum + bin.fill_level, 0) / bins.length) : 0, [bins])
  const urgent = bins.filter((bin) => bin.fill_level >= 80).length

  return <div className="min-h-screen bg-[#f7faf8] text-slate-900">
    <aside className={`fixed inset-y-0 left-0 z-30 w-72 border-r border-emerald-950/10 bg-[#12382c] px-4 py-5 text-white transition-transform lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center gap-3 px-3"><div className="grid size-10 place-items-center rounded-xl bg-emerald-400 text-[#12382c]"><Leaf size={22} strokeWidth={2.5} /></div><div><p className="font-semibold tracking-tight">SmartBin</p><p className="text-xs text-emerald-200/70">Connect operations</p></div><button className="ml-auto lg:hidden" onClick={() => setMenuOpen(false)}><X size={18} /></button></div>
      <div className="mt-10 space-y-1"><p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/50">Workspace</p>{[[Gauge, "Overview"], [PackageCheck, "My bins"], [Route, "Dispatch"], [Bot, "AI insights"]].map(([Icon, label], index) => <button key={String(label)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm ${index === 0 ? "bg-white/10 text-white" : "text-emerald-100/65 hover:bg-white/5 hover:text-white"}`}><Icon size={17} /><span>{String(label)}</span>{label === "Dispatch" && dispatch.length > 0 && <span className="ml-auto rounded-full bg-rose-400 px-2 py-0.5 text-[10px] text-white">{dispatch.length}</span>}</button>)}</div>
      <div className="mt-8 space-y-1"><p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/50">Manage</p><button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-emerald-100/65 hover:bg-white/5 hover:text-white"><Settings2 size={17} />Settings</button><button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-emerald-100/65 hover:bg-white/5 hover:text-white"><CircleHelp size={17} />Help centre</button></div>
      <div className="absolute bottom-5 left-4 right-4 rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2 text-xs font-medium text-emerald-100"><ShieldCheck size={15} className="text-emerald-300" />Network protected</div><p className="mt-2 text-xs leading-5 text-emerald-100/55">Your bins are sending encrypted telemetry.</p></div>
    </aside>
    {menuOpen && <button aria-label="Close menu" className="fixed inset-0 z-20 bg-slate-950/30 lg:hidden" onClick={() => setMenuOpen(false)} />}
    <main className="lg:pl-72">
      <header className="sticky top-0 z-10 border-b bg-[#f7faf8]/90 px-5 py-4 backdrop-blur-md sm:px-8"><div className="mx-auto flex max-w-[1400px] items-center gap-4"><button className="lg:hidden" onClick={() => setMenuOpen(true)}><Menu size={22} /></button><div className="flex-1"><div className="flex items-center gap-2 text-sm text-slate-400"><span>Workspace</span><ChevronRight size={14} /><span className="text-slate-700">Overview</span></div></div><div className="hidden items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm text-slate-400 md:flex"><Search size={16} />Search</div><button className="relative rounded-xl border bg-white p-2.5 text-slate-600"><Bell size={18} /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-rose-500" /></button><div className="relative"><button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 rounded-xl border bg-white p-1.5 pr-3"><div className="grid size-8 place-items-center rounded-lg bg-emerald-100 text-sm font-semibold text-emerald-800">MK</div><span className="hidden text-sm font-medium sm:inline">My account</span></button></div></div></header>
      <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700"><span className="size-2 rounded-full bg-emerald-500" />Live network</p><h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Good morning, Max</h1><p className="mt-2 text-slate-500">Here is what is happening across your smart bin network.</p></div><div className="flex gap-2"><button onClick={refresh} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""} />Refresh</button><button onClick={() => setShowLink(true)} className="flex items-center gap-2 rounded-xl bg-[#12382c] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#1c4c3c]"><Plus size={17} />Link a bin</button></div></div>
        {message && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Total bins" value={String(bins.length)} detail="All devices connected" icon={PackageCheck} /><StatCard label="Average fill level" value={`${average}%`} detail="Across your active bins" icon={Droplets} tone="blue" /><StatCard label="Needs attention" value={String(urgent)} detail={urgent ? "Collection recommended" : "Everything is healthy"} icon={AlertTriangle} tone="amber" /><StatCard label="Network uptime" value="99.8%" detail="Last 30 days · Excellent" icon={Activity} /></div>
        <div className="mt-8 grid gap-5 xl:grid-cols-[1.5fr_1fr]"><section className="rounded-2xl border bg-white p-5 shadow-sm shadow-emerald-950/[0.03] sm:p-6"><div className="flex items-start justify-between"><div><h2 className="font-semibold text-slate-950">Network overview</h2><p className="mt-1 text-sm text-slate-500">Fill levels across all connected bins</p></div><button className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><MoreHorizontal size={19} /></button></div><div className="mt-7 flex h-44 items-end gap-2 border-b border-l border-slate-100 px-3 pb-0 pt-4 sm:gap-4">{[32, 41, 38, 52, 49, 61, 58, 66, 63, 71, 68, average].map((height, i) => <div key={i} className="group relative flex h-full flex-1 items-end"><div className={`w-full rounded-t-md ${i === 11 ? "bg-emerald-500" : "bg-emerald-100 group-hover:bg-emerald-200"}`} style={{ height: `${Math.max(16, height * 1.15)}%` }} /><span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100">{height}%</span></div>)}</div><div className="mt-3 flex justify-between pl-3 text-[11px] text-slate-400"><span>12 days ago</span><span>Today</span></div></section><section className="rounded-2xl border bg-[#12382c] p-5 text-white shadow-sm sm:p-6"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="rounded-lg bg-emerald-400/15 p-2 text-emerald-300"><Sparkles size={18} /></div><h2 className="font-semibold">AI operations brief</h2></div><span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300">Live</span></div><p className="mt-5 text-sm leading-6 text-emerald-50/70">The network is stable. One bin is approaching capacity and should be added to the next collection route.</p><div className="mt-6 space-y-3"><div className="flex items-center gap-3 rounded-xl bg-white/8 p-3"><div className="rounded-lg bg-amber-400/15 p-2 text-amber-300"><Truck size={16} /></div><div className="flex-1"><p className="text-sm font-medium">Route suggestion ready</p><p className="text-xs text-emerald-100/55">Reduce travel by an estimated 18%</p></div><ChevronRight size={16} className="text-emerald-100/40" /></div><div className="flex items-center gap-3 rounded-xl bg-white/8 p-3"><div className="rounded-lg bg-sky-400/15 p-2 text-sky-300"><Wifi size={16} /></div><div className="flex-1"><p className="text-sm font-medium">Connectivity healthy</p><p className="text-xs text-emerald-100/55">All devices checked in recently</p></div><CheckCircle2 size={16} className="text-emerald-300" /></div></div></section></div>
        <div className="mt-8 grid gap-5 xl:grid-cols-[1.4fr_1fr]"><section className="rounded-2xl border bg-white p-5 shadow-sm shadow-emerald-950/[0.03] sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-950">Your bins</h2><p className="mt-1 text-sm text-slate-500">Real-time device status</p></div><button className="text-sm font-medium text-emerald-700 hover:text-emerald-800">View all <ChevronRight size={15} className="inline" /></button></div><div className="mt-5 space-y-3">{bins.map((bin) => <div key={bin.bin_id} className="rounded-xl border border-slate-100 p-4 transition hover:border-emerald-200 hover:shadow-sm"><div className="flex items-center gap-3"><div className={`grid size-10 place-items-center rounded-xl ${bin.fill_level >= 80 ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-600"}`}><PackageCheck size={19} /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="font-medium text-slate-900">{bin.name || bin.bin_id}</p><span className="text-xs text-slate-400">{bin.bin_id}</span></div><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><Radio size={12} className="text-emerald-500" />Online · {bin.last_seen || "Recently"}</p></div><div className="w-28 text-right"><p className={`text-sm font-semibold ${bin.fill_level >= 80 ? "text-rose-600" : "text-slate-800"}`}>{Math.round(bin.fill_level)}%</p><FillBar level={bin.fill_level} /></div></div></div>)}</div></section><section className="rounded-2xl border bg-white p-5 shadow-sm shadow-emerald-950/[0.03] sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-950">Collection queue</h2><p className="mt-1 text-sm text-slate-500">AI-prioritized dispatch tasks</p></div><Truck size={19} className="text-slate-400" /></div>{dispatch.length ? <div className="mt-5 space-y-3">{dispatch.map((task) => <div key={task.id} className="rounded-xl bg-amber-50 p-4"><div className="flex items-center justify-between"><p className="font-medium text-slate-900">{task.bin_id}</p><span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase text-amber-700">{task.priority}</span></div><p className="mt-2 text-sm text-slate-600">{task.reason}</p></div>)}</div> : <div className="mt-7 rounded-xl bg-emerald-50/70 p-5 text-center"><div className="mx-auto grid size-11 place-items-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 size={22} /></div><p className="mt-3 text-sm font-medium text-slate-800">No open collection tasks</p><p className="mt-1 text-xs leading-5 text-slate-500">Your network is being monitored continuously.</p></div>}<div className="mt-5 flex items-center gap-2 rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500"><Cloud size={15} className="text-sky-500" />Telemetry synced automatically every 30 seconds</div></section></div>
      </div>
    </main>
    {showLink && <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/30 px-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Link a smart bin</h2><p className="mt-1 text-sm text-slate-500">Use the claim code from your ESP32 device.</p></div><button onClick={() => setShowLink(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><X size={18} /></button></div><form onSubmit={linkBin} className="mt-6 space-y-4"><label className="block text-sm font-medium">Bin ID<input required value={binId} onChange={(event) => setBinId(event.target.value)} placeholder="BIN-01" className="mt-2 w-full rounded-xl border px-3 py-2.5 outline-none ring-emerald-500 focus:ring-2" /></label><label className="block text-sm font-medium">Claim code<input required value={claim} onChange={(event) => setClaim(event.target.value)} placeholder="smartbin-demo" className="mt-2 w-full rounded-xl border px-3 py-2.5 outline-none ring-emerald-500 focus:ring-2" /></label><button className="w-full rounded-xl bg-[#12382c] py-3 text-sm font-medium text-white hover:bg-[#1c4c3c]">Link device</button></form></div></div>}
  </div>
}
