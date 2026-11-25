import { useEffect, useState } from "react";
import { AlertTriangle, Check, HelpCircle, RefreshCw, Search, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { api } from "../api/client";
import Navbar from "../components/Navbar";
import StatusBadge from "../components/StatusBadge";
import TicketChat from "../components/TicketChat";
import { useAuth } from "../context/AuthContext";

export default function StaffDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState("tickets"); // tickets | escalations | refunds | audit
  const [tickets, setTickets] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const [noteInput, setNoteInput] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const loadAll = async (keepTicketId = null) => {
    setError("");
    try {
      const [ticketList, escList, refundList, auditList] = await Promise.all([
        api.listTickets({ status: statusFilter, priority: priorityFilter, search }),
        api.listEscalations(),
        api.listRefunds(),
        api.listAuditLogs(),
      ]);
      setTickets(ticketList);
      setEscalations(escList);
      setRefunds(refundList);
      setAuditLogs(auditList);

      const targetId = keepTicketId || selectedTicket?.id || ticketList[0]?.id;
      if (targetId) {
        const detail = await api.getTicket(targetId);
        setSelectedTicket(detail);
      } else {
        setSelectedTicket(null);
      }
    } catch (err) {
      setError(err.message || "Failed to load staff operations console.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadAll(selectedTicket?.id);
  };

  const handleSelectTicket = async (ticketId) => {
    try {
      const detail = await api.getTicket(ticketId);
      setSelectedTicket(detail);
      setActiveTab("tickets");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStaffReply = async (ticketId, content) => {
    setSending(true);
    try {
      await api.sendMessage(ticketId, content);
      await loadAll(ticketId);
    } finally {
      setSending(false);
    }
  };

  const handleTicketStatusUpdate = async (ticketId, updates) => {
    try {
      await api.updateTicketStaff(ticketId, updates);
      await loadAll(ticketId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEscalationDecision = async (escId, decision, approvePendingRefund = false) => {
    try {
      await api.reviewEscalation(escId, {
        decision,
        internal_note: noteInput[escId] || undefined,
        approve_pending_refund: approvePendingRefund,
      });
      await loadAll(selectedTicket?.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddInternalNote = async (escId) => {
    const text = (noteInput[escId] || "").trim();
    if (!text) return;
    try {
      await api.addEscalationNote(escId, text);
      setNoteInput((prev) => ({ ...prev, [escId]: "" }));
      await loadAll(selectedTicket?.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRefundReview = async (refundId, decision) => {
    try {
      await api.reviewRefund(refundId, {
        decision,
        review_note: `Reviewed by support staff (${decision}).`,
      });
      await loadAll(selectedTicket?.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const pendingEscalationsCount = escalations.filter((e) => e.decision === "pending").length;
  const pendingRefundsCount = refunds.filter((r) => r.status === "pending_review").length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eef4fb] via-[#f6f9fe] to-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[11px] font-semibold shadow-sm ${
                  isAdmin
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-[0_4px_14px_-4px_rgba(79,70,229,0.28)]"
                    : "border-blue-200 bg-white text-blue-700 shadow-[0_4px_14px_-4px_rgba(37,99,235,0.22)]"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{isAdmin ? "Admin Console • Full System & Audit Access" : "Support Agent Console"}</span>
              </span>
            </div>
            <h1 className="text-2xl font-bold text-navy-900">
              {isAdmin ? "Admin & Operations Console" : "Support Staff Operations Console"}
            </h1>
            <p className="text-sm text-slate-600">
              Inspect tickets, review escalated high-value cases, and approve or reject refunds.
            </p>
          </div>
          <button
            onClick={() => loadAll(selectedTicket?.id)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300/90 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Operations Summary Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="glow-card rounded-2xl border border-slate-200/90 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Tickets</p>
            <p className="mt-1.5 text-2xl font-extrabold text-navy-900">{tickets.length}</p>
          </div>
          <div className="glow-card rounded-2xl border border-amber-200/70 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pending Escalations</p>
            <p className="mt-1.5 text-2xl font-extrabold text-amber-700">{pendingEscalationsCount}</p>
          </div>
          <div className="glow-card rounded-2xl border border-blue-200/70 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Pending Refunds</p>
            <p className="mt-1.5 text-2xl font-extrabold text-blue-700">{pendingRefundsCount}</p>
          </div>
          <div className="glow-card rounded-2xl border border-slate-200/90 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audit Events</p>
            <p className="mt-1.5 text-2xl font-extrabold text-navy-900">{auditLogs.length}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200/80 pb-3">
          {[
            { id: "tickets", label: `All Tickets (${tickets.length})` },
            { id: "escalations", label: `Escalation Review (${pendingEscalationsCount} pending)` },
            { id: "refunds", label: `Refund Queue (${pendingRefundsCount} pending)` },
            { id: "audit", label: isAdmin ? `Admin Audit Log (${auditLogs.length})` : "Audit Log" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "glow-navy-btn bg-gradient-to-b from-navy-800 to-navy-900 text-white"
                  : "border border-slate-200/80 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
            Loading support queue...
          </div>
        ) : activeTab === "tickets" ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Filter + Ticket List */}
            <div className="space-y-3 lg:col-span-5">
              <form onSubmit={handleSearchSubmit} className="glow-card space-y-3 rounded-2xl border border-slate-200/90 bg-white p-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search ticket subject or description..."
                      className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-xl bg-navy-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-navy-800"
                  >
                    Search
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                  >
                    <option value="">All Statuses</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="escalated">Escalated</option>
                    <option value="waiting_for_customer">Waiting for Customer</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                  >
                    <option value="">All Priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </form>

              <div className="glow-card max-h-[580px] space-y-2 overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-3">
                {tickets.length === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-500">No tickets match the current filters.</p>
                ) : (
                  tickets.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTicket(t.id)}
                      className={`w-full rounded-xl border p-3.5 text-left transition ${
                        selectedTicket?.id === t.id
                          ? "border-blue-500 bg-blue-50/70 shadow-[0_6px_18px_-6px_rgba(37,99,235,0.28)]"
                          : "border-slate-200 hover:border-blue-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-navy-900">
                          #{t.id} &bull; {t.subject}
                        </span>
                        <StatusBadge value={t.status} />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                        <span>{t.customer?.name || `Customer #${t.customer_id}`}</span>
                        <StatusBadge value={t.priority} />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Right: Ticket Detail + Order Context + Chat */}
            <div className="space-y-4 lg:col-span-7">
              {selectedTicket && (
                <div className="glow-card rounded-2xl border border-slate-200/90 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Customer &amp; Order Context
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-navy-900">
                        {selectedTicket.customer?.name} ({selectedTicket.customer?.email})
                      </p>
                      {selectedTicket.order ? (
                        <p className="mt-0.5 text-xs text-slate-600">
                          Order <strong>{selectedTicket.order.order_code}</strong> &bull;{" "}
                          {selectedTicket.order.item_name} ({selectedTicket.order.category}) &bull; ₹
                          {Number(selectedTicket.order.total_amount).toLocaleString("en-IN")} &bull; Status:{" "}
                          <span className="font-semibold capitalize">{selectedTicket.order.status}</span>
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-slate-400">No order linked to this ticket yet.</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={selectedTicket.status}
                        onChange={(e) => handleTicketStatusUpdate(selectedTicket.id, { status: e.target.value })}
                        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="escalated">Escalated</option>
                        <option value="waiting_for_customer">Waiting for Customer</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                      <select
                        value={selectedTicket.priority}
                        onChange={(e) => handleTicketStatusUpdate(selectedTicket.id, { priority: e.target.value })}
                        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <TicketChat
                ticket={selectedTicket}
                onSendMessage={handleStaffReply}
                sending={sending}
                isStaffView
              />
            </div>
          </div>
        ) : activeTab === "escalations" ? (
          <div className="space-y-4">
            {escalations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                No escalations in queue.
              </div>
            ) : (
              escalations.map((esc) => (
                <div key={esc.id} className="glow-card rounded-2xl border border-slate-200/90 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <h3 className="text-base font-bold text-navy-900">
                          Escalation #{esc.id} &bull; Ticket #{esc.ticket_id}
                        </h3>
                        <StatusBadge value={esc.priority} />
                        <StatusBadge value={esc.decision} />
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{esc.summary}</p>
                      {esc.internal_note && (
                        <div className="mt-3 rounded-xl bg-amber-50/70 p-3 text-xs text-slate-700">
                          <span className="font-semibold text-amber-900">Internal Notes:</span>
                          <p className="mt-1 whitespace-pre-wrap">{esc.internal_note}</p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleSelectTicket(esc.ticket_id)}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      Inspect Ticket &amp; Chat
                    </button>
                  </div>

                  {/* Staff Actions */}
                  <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-1 gap-2">
                      <input
                        type="text"
                        value={noteInput[esc.id] || ""}
                        onChange={(e) => setNoteInput((prev) => ({ ...prev, [esc.id]: e.target.value }))}
                        placeholder="Add internal review note or info request..."
                        className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddInternalNote(esc.id)}
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Save Note
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleEscalationDecision(esc.id, "approved", true)}
                        className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_6px_16px_-4px_rgba(16,185,129,0.5)] transition hover:opacity-95"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve &amp; Refund</span>
                      </button>
                      <button
                        onClick={() => handleEscalationDecision(esc.id, "more_info_requested", false)}
                        className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_6px_16px_-4px_rgba(124,58,237,0.45)] transition hover:opacity-95"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        <span>Request Info</span>
                      </button>
                      <button
                        onClick={() => handleEscalationDecision(esc.id, "rejected", false)}
                        className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_6px_16px_-4px_rgba(225,29,72,0.45)] transition hover:opacity-95"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === "refunds" ? (
          <div className="glow-card overflow-x-auto rounded-2xl border border-slate-200/90 bg-white p-5">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="pb-2.5 pr-4">Refund</th>
                  <th className="pb-2.5 pr-4">Order</th>
                  <th className="pb-2.5 pr-4">Amount</th>
                  <th className="pb-2.5 pr-4">Reason</th>
                  <th className="pb-2.5 pr-4">Status</th>
                  <th className="pb-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {refunds.map((ref) => (
                  <tr key={ref.id}>
                    <td className="py-3 pr-4 font-semibold text-navy-900">#{ref.id} (Ticket #{ref.ticket_id})</td>
                    <td className="py-3 pr-4 text-slate-700">{ref.order?.order_code || `#${ref.order_id}`}</td>
                    <td className="py-3 pr-4 font-bold text-slate-800">
                      ₹{Number(ref.amount).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{ref.reason}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge value={ref.status} />
                    </td>
                    <td className="py-3 text-right">
                      {ref.status === "pending_review" ? (
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => handleRefundReview(ref.id, "approved")}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRefundReview(ref.id, "rejected")}
                            className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="glow-card overflow-x-auto rounded-2xl border border-slate-200/90 bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-blue-600" />
              <h2 className="text-base font-bold text-navy-900">Recent Security &amp; Refund Audit Events</h2>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 uppercase text-slate-500">
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">Event</th>
                  <th className="pb-2 pr-4">Actor Role</th>
                  <th className="pb-2 pr-4">Entity</th>
                  <th className="pb-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 pr-4 text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="py-2.5 pr-4 font-semibold text-navy-900">{log.event_type}</td>
                    <td className="py-2.5 pr-4 capitalize text-slate-600">{log.actor_role}</td>
                    <td className="py-2.5 pr-4 text-slate-600">
                      {log.entity_type} #{log.entity_id}
                    </td>
                    <td className="py-2.5 text-slate-700">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
