const STYLES = {
  open: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-indigo-50 text-indigo-700 border-indigo-200",
  escalated: "bg-amber-50 text-amber-800 border-amber-200",
  waiting_for_customer: "bg-purple-50 text-purple-700 border-purple-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-slate-100 text-slate-600 border-slate-200",

  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  shipped: "bg-sky-50 text-sky-700 border-sky-200",
  processing: "bg-slate-100 text-slate-700 border-slate-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",

  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  processed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending_review: "bg-amber-50 text-amber-800 border-amber-200",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  more_info_requested: "bg-purple-50 text-purple-700 border-purple-200",

  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-blue-50 text-blue-700 border-blue-200",
  high: "bg-amber-50 text-amber-800 border-amber-200",
  urgent: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function StatusBadge({ value }) {
  const normalized = (value || "unknown").toLowerCase();
  const label = normalized.replace(/_/g, " ");
  const style = STYLES[normalized] || "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${style}`}>
      {label}
    </span>
  );
}
