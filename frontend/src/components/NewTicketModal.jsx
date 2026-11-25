import { useState } from "react";
import { X } from "lucide-react";

export default function NewTicketModal({ orders, initialOrderId = "", onClose, onCreate }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("refund");
  const [priority, setPriority] = useState("medium");
  const [orderId, setOrderId] = useState(initialOrderId ? String(initialOrderId) : "");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (subject.trim().length < 3) {
      setError("Subject must be at least 3 characters.");
      return;
    }
    if (description.trim().length < 5) {
      setError("Please describe your issue in at least 5 characters.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onCreate({
        subject: subject.trim(),
        category,
        priority,
        order_id: orderId ? Number(orderId) : null,
        description: description.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.message || "Could not create support ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="glow-hero-chat w-full max-w-lg rounded-2xl border border-white/80 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy-900">Create Support Ticket</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <div className="mb-4 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Subject
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Damaged headphones on arrival"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
              >
                <option value="refund">Refund Request</option>
                <option value="damaged_item">Damaged Item</option>
                <option value="order_issue">Order Issue</option>
                <option value="delivery">Delivery Question</option>
                <option value="general">General Policy</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Related Order (Optional)
            </label>
            <select
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
            >
              <option value="">-- No order selected (ask AI first) --</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_code} &bull; {o.item_name} (₹{Number(o.total_amount).toLocaleString("en-IN")})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Description
            </label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain what happened and whether you'd like a refund or policy check..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="glow-navy-btn rounded-xl bg-gradient-to-b from-navy-800 to-navy-900 px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Submit & Start AI Chat"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
