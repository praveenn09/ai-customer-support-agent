import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const staffHint = searchParams.get("role") === "staff";

  const [email, setEmail] = useState(staffHint ? "agent@example.com" : "");
  const [password, setPassword] = useState(staffHint ? "Staff@123" : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      if (user.role === "agent" || user.role === "admin") {
        navigate("/staff");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eef4fb] via-[#f6f9fe] to-white">
      <Navbar />
      <main className="mx-auto max-w-md px-4 py-12">
        <div className="glow-card rounded-2xl border border-slate-200/90 bg-white p-7">
          <h1 className="text-2xl font-bold text-navy-900">Sign in to SupportDesk</h1>
          <p className="mt-1 text-sm text-slate-600">Access your orders, support tickets, or staff console.</p>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="glow-navy-btn w-full rounded-xl bg-gradient-to-b from-navy-800 to-navy-900 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {/* Quick Demo Accounts */}
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Demo Credentials (Local Seed Data)
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => fillDemo("aarav@example.com", "Customer@123")}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs transition hover:border-blue-300 hover:bg-blue-50/50"
              >
                <span className="block font-semibold text-navy-900">Customer</span>
                <span className="block truncate text-slate-500">aarav@example.com</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemo("agent@example.com", "Staff@123")}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs transition hover:border-blue-300 hover:bg-blue-50/50"
              >
                <span className="block font-semibold text-navy-900">Agent</span>
                <span className="block truncate text-slate-500">agent@example.com</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemo("admin@example.com", "Admin@123")}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs transition hover:border-indigo-300 hover:bg-indigo-50/50"
              >
                <span className="block font-semibold text-indigo-900">Admin</span>
                <span className="block truncate text-slate-500">admin@example.com</span>
              </button>
            </div>
          </div>

          <p className="mt-5 text-center text-sm text-slate-600">
            New customer?{" "}
            <Link to="/register" className="font-semibold text-blue-600 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
