import { useState } from "react";
import { Bot, CheckCircle2, AlertTriangle, Send, User, ShieldAlert } from "lucide-react";
import StatusBadge from "./StatusBadge";

function parseMeta(metaJson) {
  if (!metaJson) return null;
  try {
    return JSON.parse(metaJson);
  } catch {
    return null;
  }
}

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function TicketChat({ ticket, onSendMessage, sending, isStaffView = false }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  if (!ticket) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <Bot className="mb-3 h-10 w-10 text-slate-400" />
        <p className="text-base font-semibold text-slate-700">Select a ticket to view the conversation</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Your chat history with the SupportDesk AI agent and support staff appears here.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) {
      setError("Please enter a message before sending.");
      return;
    }
    setError("");
    try {
      await onSendMessage(ticket.id, text);
      setDraft("");
    } catch (err) {
      setError(err.message || "Failed to send message.");
    }
  };

  return (
    <div className="glow-card flex h-full min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/40 px-5 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-navy-900">
              Ticket #{ticket.id} &bull; {ticket.subject}
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Category: <span className="font-medium capitalize">{ticket.category.replace(/_/g, " ")}</span>
            {ticket.order && (
              <>
                {" "}&bull; Linked Order:{" "}
                <span className="font-semibold text-slate-700">{ticket.order.order_code}</span> (₹
                {Number(ticket.order.total_amount).toLocaleString("en-IN")})
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge value={ticket.priority} />
          <StatusBadge value={ticket.status} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/40 p-5">
        {(ticket.messages || []).length === 0 ? (
          <p className="text-center text-sm text-slate-500">No messages in this ticket yet.</p>
        ) : (
          ticket.messages.map((msg) => {
            const isCustomer = msg.sender_type === "customer";
            const isStaffMsg = msg.sender_type === "staff";
            const meta = parseMeta(msg.meta_json);

            return (
              <div key={msg.id} className={`flex flex-col ${isCustomer ? "items-end" : "items-start"}`}>
                <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
                  {isCustomer ? (
                    <>
                      <span>Customer</span>
                      <User className="h-3.5 w-3.5" />
                    </>
                  ) : isStaffMsg ? (
                    <>
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                      <span className="font-semibold text-amber-700">Support Staff</span>
                    </>
                  ) : (
                    <>
                      <Bot className="h-3.5 w-3.5 text-blue-600" />
                      <span className="font-semibold text-blue-700">SupportDesk AI</span>
                    </>
                  )}
                  <span>&bull; {formatTime(msg.created_at)}</span>
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isCustomer
                      ? "bg-gradient-to-br from-navy-800 to-navy-900 text-white shadow-[0_8px_18px_-6px_rgba(11,23,54,0.45)]"
                      : isStaffMsg
                      ? "border border-amber-200 bg-amber-50 text-slate-800 shadow-sm"
                      : "border border-slate-200/90 bg-white text-slate-800 shadow-[0_4px_14px_-4px_rgba(15,23,42,0.08)]"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {meta?.badge && (
                    <div
                      className={`mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        meta.badge_tone === "success"
                          ? "bg-emerald-600 text-white"
                          : meta.badge_tone === "warning"
                          ? "bg-amber-100 text-amber-900"
                          : meta.badge_tone === "danger"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {meta.badge_tone === "success" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      )}
                      <span>{meta.badge}</span>
                    </div>
                  )}

                  {meta?.tools_used?.length > 0 && (
                    <p className="mt-2 text-[11px] text-slate-400">
                      Tools verified: {meta.tools_used.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}

        {sending && (
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span className="h-2 w-2 animate-ping rounded-full bg-blue-600" />
            <span>SupportDesk AI is verifying policy and order details...</span>
          </div>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-4">
        {error && (
          <div className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={sending}
            placeholder={
              isStaffView
                ? "Send a staff response to the customer..."
                : "Type your message (e.g., 'Please refund order ORD-2381')..."
            }
            className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            <span>{sending ? "Sending..." : "Send"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
