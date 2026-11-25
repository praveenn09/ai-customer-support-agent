import { X, PackageCheck } from "lucide-react";
import StatusBadge from "./StatusBadge";

export default function OrderDetailModal({ order, refunds = [], onClose, onRaiseTicket }) {
  if (!order) return null;

  const orderRefunds = refunds.filter((r) => r.order_id === order.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="glow-hero-chat w-full max-w-md rounded-2xl border border-white/80 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-navy-900">Order {order.order_code}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Item</span>
            <span className="font-semibold text-slate-800">{order.item_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Category</span>
            <span className="font-medium text-slate-700">{order.category}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Amount</span>
            <span className="font-bold text-navy-900">₹{Number(order.total_amount).toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Order Status</span>
            <StatusBadge value={order.status} />
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Delivery Date</span>
            <span className="text-slate-700">
              {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : "In transit"}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Refund Progress</h3>
          {orderRefunds.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500">
              No refund requests submitted for this order.
            </p>
          ) : (
            <div className="space-y-2">
              {orderRefunds.map((ref) => (
                <div key={ref.id} className="rounded-xl border border-slate-200 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      Refund #{ref.id} &bull; ₹{Number(ref.amount).toLocaleString("en-IN")}
                    </span>
                    <StatusBadge value={ref.status} />
                  </div>
                  <p className="mt-1 text-slate-600">{ref.reason}</p>
                  {ref.review_note && <p className="mt-1 text-slate-500 italic">Staff note: {ref.review_note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
          <button
            onClick={() => {
              onClose();
              onRaiseTicket(order.id);
            }}
            className="glow-navy-btn rounded-xl bg-gradient-to-b from-navy-800 to-navy-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          >
            Raise Ticket for Order
          </button>
        </div>
      </div>
    </div>
  );
}
