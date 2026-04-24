"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { LayoutDashboard, MessageSquare, Bot, Users, CheckSquare, Map, Lightbulb, Zap, Activity, FlaskConical } from "lucide-react"

const NAV = [
  { href:"/",             icon:LayoutDashboard, label:"Dashboard"    },
  { href:"/chat",         icon:MessageSquare,   label:"AI Chat"       },
  { href:"/pipeline",     icon:Activity,        label:"Pipeline"      },
  { href:"/agents",       icon:Bot,             label:"Agents"        },
  { href:"/meeting",      icon:Users,           label:"Meetings"      },
  { href:"/tasks",        icon:CheckSquare,     label:"Tasks"         },
  { href:"/roadmap",      icon:Map,             label:"Roadmap"       },
  { href:"/improvements", icon:Lightbulb,       label:"Improvements"  },
]

export default function Sidebar() {
  const path = usePathname()
  const [stats, setStats] = useState<{papers:number;proteins:number}|null>(null)

  useEffect(() => {
    fetch("/api/pipeline").then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats({ papers: d.papers.total, proteins: d.proteins.total }) })
      .catch(() => {})
  }, [])

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
            <FlaskConical size={15} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800 tracking-tight">MATON AI</div>
            <div className="text-[10px] text-slate-400 font-medium">Scientific Platform</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = path === href
          return (
            <Link key={href} href={href} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              active
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}>
              <Icon size={14} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-100">
        <div className="flex items-center gap-2 mb-2">
          <span className="dot dot-active" />
          <span className="text-[10px] text-green-600 font-semibold">Autonomous Mode ON</span>
        </div>
        <div className="text-[10px] text-slate-400">
          {stats ? `${stats.papers} papers · ${stats.proteins} proteins` : "410 papers · 99 proteins"}
        </div>
        <div className="text-[10px] text-slate-300 mt-0.5">Powered by Gemini 1.5 Pro</div>
      </div>
    </aside>
  )
}
