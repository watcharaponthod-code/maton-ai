export default function Badge({ v, children }: { v?: string; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    blue:   "bg-blue-50 text-blue-700 border-blue-200",
    green:  "bg-green-50 text-green-700 border-green-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    amber:  "bg-amber-50 text-amber-700 border-amber-200",
    slate:  "bg-slate-100 text-slate-600 border-slate-200",
    cyan:   "bg-cyan-50 text-cyan-700 border-cyan-200",
    red:    "bg-red-50 text-red-700 border-red-200",
  }
  const cls = styles[v ?? "slate"] ?? styles.slate
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${cls}`}>
      {children}
    </span>
  )
}
