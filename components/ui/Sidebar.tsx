"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, MessageSquare, Bot, Users, CheckSquare, Map, Lightbulb, Zap } from "lucide-react"

const NAV = [
  { href:"/",            icon:LayoutDashboard, label:"Dashboard"    },
  { href:"/chat",        icon:MessageSquare,   label:"AI Chat"       },
  { href:"/agents",      icon:Bot,             label:"Agents"        },
  { href:"/meeting",     icon:Users,           label:"Meetings"      },
  { href:"/tasks",       icon:CheckSquare,     label:"Tasks"         },
  { href:"/roadmap",     icon:Map,             label:"Roadmap"       },
  { href:"/improvements",icon:Lightbulb,       label:"Improvements"  },
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <aside className="w-52 shrink-0 flex flex-col border-r border-[#1a2840] bg-[#0a1020]">
      <div className="px-4 py-4 border-b border-[#1a2840]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">MATON AI</div>
            <div className="text-[10px] text-slate-500">Scientific Platform</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = path === href
          return (
            <Link key={href} href={href} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
              active ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}>
              <Icon size={14} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-3 border-t border-[#1a2840]">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="dot dot-active" />
          <span className="text-[10px] text-green-400">Autonomous Mode ON</span>
        </div>
        <div className="text-[10px] text-slate-600">193 papers · 99 proteins</div>
      </div>
    </aside>
  )
}
