import { Link, useNavigate } from "react-router-dom";
import { LogOut, MessageSquare, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, isStaff, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 shadow-[0_4px_20px_-10px_rgba(15,23,42,0.08)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-navy-800 to-navy-900 text-white shadow-[0_6px_16px_-4px_rgba(37,99,235,0.45)]">
            <MessageSquare className="h-4 w-4" />
          </span>
          <span className="text-lg font-bold tracking-tight text-navy-900">
            Support<span className="text-blue-600">Desk</span>
          </span>
        </Link>

        {!user ? (
          <nav className="flex items-center gap-3 sm:gap-6">
            <a href="/#how-it-works" className="hidden text-sm font-medium text-slate-600 hover:text-navy-900 sm:inline">
              How it works
            </a>
            <a href="/#features" className="hidden text-sm font-medium text-slate-600 hover:text-navy-900 sm:inline">
              Features
            </a>
            <Link
              to="/login"
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="glow-navy-btn rounded-lg bg-gradient-to-b from-navy-800 to-navy-900 px-4 py-2 text-sm font-semibold text-white transition hover:from-navy-700 hover:to-navy-800"
            >
              Create account
            </Link>
          </nav>
        ) : (
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to={isStaff ? "/staff" : "/dashboard"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              {isStaff && <ShieldCheck className="h-4 w-4 text-blue-600" />}
              <span>{isStaff ? "Staff Console" : "My Dashboard"}</span>
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">{user.name}</p>
              <p className="text-xs capitalize text-slate-500">{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
