import { Link } from "react-router-dom";
import { ArrowRight, Bot, CheckCircle2, Headphones, MessageSquare, ShieldCheck } from "lucide-react";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";

export default function LandingPage() {
  const { user, isStaff } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#eef4fb] via-[#f6f9fe] to-white">
      {/* Subtle ambient dot matrix & radial glow */}
      <div className="bg-dot-pattern pointer-events-none absolute right-0 top-14 h-96 w-96 opacity-45 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="pointer-events-none absolute -left-24 top-20 h-96 w-96 rounded-full bg-blue-200/30 blur-3xl" />

      <Navbar />

      {/* Hero Section */}
      <section className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:py-20">
        <div className="lg:col-span-6">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white/90 px-3.5 py-1 text-xs font-semibold text-blue-700 shadow-[0_4px_16px_-4px_rgba(37,99,235,0.22)]">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.9)]" />
            <span>AI support agent + human review</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-navy-900 sm:text-5xl">
            Orders, refunds and answers,{" "}
            <span className="bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
              resolved in one chat.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Raise a ticket, ask about your order and request a refund. Our agent checks your order and
            the return policy, and hands bigger cases to a real person.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3.5">
            <Link
              to={user ? (isStaff ? "/staff" : "/dashboard") : "/login"}
              className="glow-navy-btn inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-navy-800 to-navy-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              <span>{user ? "Go to Dashboard" : "Start a conversation"}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login?role=staff"
              className="inline-flex items-center rounded-xl border border-slate-300/90 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-[0_6px_18px_-6px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              Staff sign in
            </Link>
          </div>
        </div>

        {/* Hero Interactive-Style Chat Preview Card with ambient glow & layered depth */}
        <div className="relative lg:col-span-6">
          {/* Soft blue aura behind chat card */}
          <div className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-blue-400/20 via-sky-300/15 to-indigo-400/20 blur-2xl" />
          {/* Faint stacked backdrop card */}
          <div className="pointer-events-none absolute -bottom-3 left-4 right-4 h-12 rounded-3xl border border-slate-200/70 bg-white/70 shadow-lg" />

          <div className="glow-hero-chat relative overflow-hidden rounded-3xl border border-white/80 bg-white">
            {/* Dark Navy Header Bar */}
            <div className="flex items-center justify-between bg-gradient-to-r from-navy-900 via-navy-800 to-blue-900 px-5 py-3.5 text-white">
              <span className="text-sm font-bold tracking-tight">Ticket #1042 &bull; Damaged item</span>
              <span className="rounded-full bg-gradient-to-r from-blue-500 to-sky-400 px-3 py-0.5 text-xs font-semibold text-white shadow-[0_0_14px_rgba(56,189,248,0.65)]">
                Open
              </span>
            </div>

            <div className="space-y-3 bg-gradient-to-b from-slate-50/60 to-white p-5 text-sm">
              <div className="flex flex-col items-end">
                <div className="max-w-[85%] rounded-2xl bg-gradient-to-br from-navy-800 to-navy-900 px-4 py-2.5 text-white shadow-[0_8px_20px_-6px_rgba(11,23,54,0.45)]">
                  My headphones arrived with a cracked band. I&apos;d like a refund.
                </div>
                <span className="mt-1 text-[11px] text-slate-400">10:43 AM</span>
              </div>

              <div className="flex flex-col items-start">
                <div className="max-w-[85%] rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 text-slate-700 shadow-[0_4px_14px_-4px_rgba(15,23,42,0.08)]">
                  Sorry about that. Could you share your order ID so I can check it?
                </div>
              </div>

              <div className="flex flex-col items-end">
                <div className="rounded-2xl bg-gradient-to-br from-navy-800 to-navy-900 px-4 py-2 text-white shadow-[0_8px_20px_-6px_rgba(11,23,54,0.45)]">
                  Order #ORD-2381
                </div>
              </div>

              <div className="flex flex-col items-start">
                <div className="max-w-[90%] rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 text-slate-700 shadow-[0_4px_14px_-4px_rgba(15,23,42,0.08)]">
                  Delivered 3 days ago, inside the 10-day return window. Refund of ₹3,499 is eligible.
                </div>
              </div>

              <div className="pt-1">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_8px_20px_-4px_rgba(16,185,129,0.55)]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Refund approved &bull; Processing
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8">
          <h2 className="text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">
            Built for customers and support staff
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 sm:text-base">
            Every action is checked by the backend, not just the chat.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="glow-card group rounded-2xl border border-slate-200/90 bg-white p-6 transition duration-200 hover:-translate-y-0.5 hover:border-blue-200">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <Bot className="h-5 w-5" />
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-[0_10px_24px_-4px_rgba(59,130,246,0.55)]">
                <MessageSquare className="h-6 w-6" />
              </div>
            </div>
            <h3 className="text-base font-bold text-navy-900">AI chat agent</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Asks for missing details, looks up orders, and reads the return policy before it answers.
            </p>
          </div>

          <div className="glow-card group rounded-2xl border border-slate-200/90 bg-white p-6 transition duration-200 hover:-translate-y-0.5 hover:border-blue-200">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-[0_10px_24px_-4px_rgba(37,99,235,0.55)]">
                <ShieldCheck className="h-6 w-6" />
              </div>
            </div>
            <h3 className="text-base font-bold text-navy-900">Safe refunds</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Ownership, return window, and amount are verified on the server. Duplicate requests never double-pay.
            </p>
          </div>

          <div className="glow-card group rounded-2xl border border-slate-200/90 bg-white p-6 transition duration-200 hover:-translate-y-0.5 hover:border-blue-200">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <Headphones className="h-5 w-5" />
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-[0_10px_24px_-4px_rgba(79,70,229,0.55)]">
                <Headphones className="h-6 w-6" />
              </div>
            </div>
            <h3 className="text-base font-bold text-navy-900">Human review</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Refunds above ₹5,000 go to a support agent with full context to approve, reject, or ask for more.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Banner with outer blue glow */}
      <section id="how-it-works" className="relative mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6">
        <div className="pointer-events-none absolute inset-x-10 bottom-12 top-6 rounded-3xl bg-blue-500/20 blur-2xl" />
        <div className="glow-banner relative overflow-hidden rounded-3xl border border-blue-400/20 bg-gradient-to-br from-[#061333] via-[#0b235a] to-[#0a1b47] p-8 text-white sm:p-10">
          {/* Subtle inner radial glow spot */}
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl" />

          <h2 className="relative text-xl font-bold tracking-tight sm:text-2xl">How it works</h2>
          <div className="relative mt-6 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div>
              <p className="text-3xl font-extrabold text-sky-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.65)]">
                1
              </p>
              <h3 className="mt-2 text-base font-bold">Sign in</h3>
              <p className="mt-1 text-sm text-slate-300">
                View your orders and open tickets in one dashboard.
              </p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-sky-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.65)]">
                2
              </p>
              <h3 className="mt-2 text-base font-bold">Chat with the agent</h3>
              <p className="mt-1 text-sm text-slate-300">
                Describe the issue and pick an order. Your history is saved.
              </p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-sky-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.65)]">
                3
              </p>
              <h3 className="mt-2 text-base font-bold">Track the outcome</h3>
              <p className="mt-1 text-sm text-slate-300">
                Follow ticket and refund status until it is resolved.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white/90 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 text-xs text-slate-500 sm:px-6">
          <div className="flex items-center gap-2 font-semibold text-navy-900">
            <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
            <span>SupportDesk</span>
          </div>
          {/* <span>Demo project &bull; Simulated payments only</span> */}
        </div>
      </footer>
    </div>
  );
}
