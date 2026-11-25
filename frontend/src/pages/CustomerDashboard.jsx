import { useEffect, useState } from "react";
import { Package, Plus, RefreshCw, Receipt, Ticket as TicketIcon } from "lucide-react";
import { api } from "../api/client";
import Navbar from "../components/Navbar";
import NewTicketModal from "../components/NewTicketModal";
import OrderDetailModal from "../components/OrderDetailModal";
import StatusBadge from "../components/StatusBadge";
import TicketChat from "../components/TicketChat";
import { useAuth } from "../context/AuthContext";

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const [showNewTicket, setShowNewTicket] = useState(false);
  const [prefillOrderId, setPrefillOrderId] = useState("");
  const [detailOrder, setDetailOrder] = useState(null);

  const loadDashboard = async (keepTicketId = null) => {
    setError("");
    try {
      const [ordersData, ticketsData, refundsData] = await Promise.all([
        api.listOrders(),
        api.listTickets(),
        api.listRefunds(),
      ]);
      setOrders(ordersData);
      setTickets(ticketsData);
      setRefunds(refundsData);

      const targetId = keepTicketId || selectedTicket?.id || ticketsData[0]?.id;
      if (targetId) {
        const detail = await api.getTicket(targetId);
        setSelectedTicket(detail);
      } else {
        setSelectedTicket(null);
      }
    } catch (err) {
      setError(err.message || "Unable to load your dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectTicket = async (ticketId) => {
    try {
      const detail = await api.getTicket(ticketId);
      setSelectedTicket(detail);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateTicket = async (payload) => {
    const created = await api.createTicket(payload);
    await loadDashboard(created.id);
  };

  const handleSendMessage = async (ticketId, content) => {
    setSending(true);
    try {
      await api.sendMessage(ticketId, content);
      await loadDashboard(ticketId);
    } finally {
      setSending(false);
    }
  };

  const openTicketCount = tickets.filter((t) => !["resolved", "closed"].includes(t.status)).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eef4fb] via-[#f6f9fe] to-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {/* Header & CTA */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.9)]" />
              Customer Portal
            </div>
            <h1 className="text-2xl font-bold text-navy-900">Welcome back, {user?.name}</h1>
            <p className="text-sm text-slate-600">
              Manage your orders, chat with SupportDesk AI, and track refund progress.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadDashboard(selectedTicket?.id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300/90 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => {
                setPrefillOrderId("");
                setShowNewTicket(true);
              }}
              className="glow-navy-btn inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-navy-800 to-navy-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              <span>New Support Ticket</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="glow-card rounded-2xl border border-slate-200/90 bg-white p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>My Orders</span>
              <Package className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-navy-900">{orders.length}</p>
          </div>
          <div className="glow-card rounded-2xl border border-slate-200/90 bg-white p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Active Tickets</span>
              <TicketIcon className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-navy-900">{openTicketCount}</p>
          </div>
          <div className="glow-card rounded-2xl border border-slate-200/90 bg-white p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Refund Requests</span>
              <Receipt className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-navy-900">{refunds.length}</p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
            Loading your orders and support history...
          </div>
        ) : (
          <>
            {/* Tickets + AI Chat Split View */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-3 lg:col-span-5">
                <div className="glow-card rounded-2xl border border-slate-200/90 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-bold text-navy-900">Your Support Tickets</h2>
                    <span className="text-xs text-slate-500">{tickets.length} total</span>
                  </div>

                  {tickets.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                      No tickets yet. Click &ldquo;New Support Ticket&rdquo; to start a chat!
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {tickets.map((t) => {
                        const isSelected = selectedTicket?.id === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => handleSelectTicket(t.id)}
                            className={`w-full rounded-xl border p-3.5 text-left transition ${
                              isSelected
                                ? "border-blue-500 bg-blue-50/70 shadow-[0_6px_18px_-6px_rgba(37,99,235,0.28)]"
                                : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-semibold text-navy-900">
                                #{t.id} &bull; {t.subject}
                              </span>
                              <StatusBadge value={t.status} />
                            </div>
                            <p className="mt-1 line-clamp-1 text-xs text-slate-500">{t.description}</p>
                            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                              <span className="capitalize">{t.category.replace(/_/g, " ")}</span>
                              <span>{new Date(t.updated_at).toLocaleDateString()}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Refunds Summary */}
                <div className="glow-card rounded-2xl border border-slate-200/90 bg-white p-4">
                  <h2 className="mb-3 text-base font-bold text-navy-900">Refund Status</h2>
                  {refunds.length === 0 ? (
                    <p className="text-xs text-slate-500">No refunds submitted yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {refunds.map((ref) => (
                        <div key={ref.id} className="rounded-xl border border-slate-200 p-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-navy-900">
                              {ref.order?.order_code || `Order #${ref.order_id}`} &bull; ₹
                              {Number(ref.amount).toLocaleString("en-IN")}
                            </span>
                            <StatusBadge value={ref.status} />
                          </div>
                          <p className="mt-1 text-slate-600">{ref.reason}</p>
                          {ref.review_note && (
                            <p className="mt-1 italic text-slate-500">Review note: {ref.review_note}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Window */}
              <div className="lg:col-span-7">
                <TicketChat
                  ticket={selectedTicket}
                  onSendMessage={handleSendMessage}
                  sending={sending}
                />
              </div>
            </div>

            {/* Recent Orders Table */}
            <div className="glow-card rounded-2xl border border-slate-200/90 bg-white p-5">
              <h2 className="mb-4 text-base font-bold text-navy-900">Recent Orders</h2>
              {orders.length === 0 ? (
                <p className="text-sm text-slate-500">No orders found on your account.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                        <th className="pb-2.5 pr-4">Order ID</th>
                        <th className="pb-2.5 pr-4">Item</th>
                        <th className="pb-2.5 pr-4">Category</th>
                        <th className="pb-2.5 pr-4">Amount</th>
                        <th className="pb-2.5 pr-4">Status</th>
                        <th className="pb-2.5 pr-4">Delivered</th>
                        <th className="pb-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50/70">
                          <td className="py-3 pr-4 font-semibold text-navy-900">{order.order_code}</td>
                          <td className="py-3 pr-4 text-slate-700">{order.item_name}</td>
                          <td className="py-3 pr-4 text-slate-500">{order.category}</td>
                          <td className="py-3 pr-4 font-semibold text-slate-800">
                            ₹{Number(order.total_amount).toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge value={order.status} />
                          </td>
                          <td className="py-3 pr-4 text-slate-500">
                            {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-3 text-right">
                            <div className="inline-flex gap-2">
                              <button
                                onClick={() => setDetailOrder(order)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                Details
                              </button>
                              <button
                                onClick={() => {
                                  setPrefillOrderId(order.id);
                                  setShowNewTicket(true);
                                }}
                                className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                              >
                                Get Help
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {showNewTicket && (
        <NewTicketModal
          orders={orders}
          initialOrderId={prefillOrderId}
          onClose={() => setShowNewTicket(false)}
          onCreate={handleCreateTicket}
        />
      )}

      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          refunds={refunds}
          onClose={() => setDetailOrder(null)}
          onRaiseTicket={(ordId) => {
            setPrefillOrderId(ordId);
            setShowNewTicket(true);
          }}
        />
      )}
    </div>
  );
}
