"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import type { FormEvent } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Signup failed");
        return;
      }
      router.replace("/");
    } catch {
      setError("Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafafa] px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <div className="w-10 h-10 rounded-full bg-[#181818] flex items-center justify-center">
            <span className="text-[11px] font-bold text-white">Q</span>
          </div>
          <a href="/" className="text-sm text-[#181818] hover:text-[#666]">
            Back to Quill
          </a>
        </div>

        <h1 className="text-2xl font-semibold text-[#181818] mb-2">Create your Quill account</h1>
        <p className="text-[#666] mb-6">
          Start writing theses, projects, and literature reviews with AI assistance.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg border border-[#ef4444] bg-[#fef2f2] text-xs text-[#ef4444]">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#181818]">Full name</label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-4 h-4 text-[#888]" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-[#e5e5e5] bg-white px-4 py-3 pl-10 text-sm text-[#181818] outline-none focus:ring-2 focus:ring-[#181818]"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#181818]">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-[#888]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-[#e5e5e5] bg-white px-4 py-3 pl-10 text-sm text-[#181818] outline-none focus:ring-2 focus:ring-[#181818]"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#181818]">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-[#888]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#e5e5e5] bg-white px-4 py-3 pl-10 text-sm text-[#181818] outline-none focus:ring-2 focus:ring-[#181818]"
              />
            </div>
            <p className="text-[10px] text-[#888]">At least 8 characters</p>
          </div>
          <button
            disabled={busy}
            className="w-full rounded-lg bg-[#181818] px-4 py-3 text-sm font-semibold text-white hover:bg-[#333] disabled:bg-[#e5e5e5] disabled:text-[#999] transition-colors"
          >
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#666]">
          Already have an account?{" "}
          <a href="/auth/signin" className="text-[#181818] font-medium hover:text-[#666]">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
