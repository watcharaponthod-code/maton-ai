import clsx from "clsx"
const V: Record<string,string> = {
  cyan:   "bg-cyan-500/10   text-cyan-400   border border-cyan-500/20",
  green:  "bg-green-500/10  text-green-400  border border-green-500/20",
  red:    "bg-red-500/10    text-red-400    border border-red-500/20",
  yellow: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  purple: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  gray:   "bg-slate-500/10  text-slate-400  border border-slate-500/20",
  orange: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  amber:  "bg-amber-500/10  text-amber-300  border border-amber-500/20",
  pink:   "bg-pink-500/10   text-pink-400   border border-pink-500/20",
}
export default function Badge({ children, v="gray" }: { children:React.ReactNode; v?: keyof typeof V }) {
  return <span className={clsx("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium", V[v])}>{children}</span>
}
