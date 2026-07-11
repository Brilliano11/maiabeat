"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { useAuthStore } from "@/store/authStore";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/home";
  const [email, setEmail] = useState("anggitaramo@gmail.com");
  const [password, setPassword] = useState("maia123");
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await login(email, password);
    if (ok) {
      router.refresh();
      router.replace(nextPath);
    }
  };

  return (
    <AppShell withNav={false} className="grid place-items-center pb-4">
      <form onSubmit={submit} className="mx-auto grid w-full max-w-[520px] gap-4">
        <div>
          <p className="page-kicker">Welcome back</p>
          <h1 className="page-title">Maiabeat</h1>
        </div>
        <BrutalCard className="grid gap-3 bg-[#00C2FF]">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
            placeholder="Email"
            className="h-12 rounded-2xl border-[3px] border-black bg-white px-3 font-bold outline-none"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            required
            placeholder="Password"
            className="h-12 rounded-2xl border-[3px] border-black bg-white px-3 font-bold outline-none"
          />
          {error ? <p className="text-sm font-black text-[#FF3B6B]">{error}</p> : null}
          <BrutalButton type="submit" icon={<LogIn size={18} />} disabled={loading}>
            {loading ? "Logging in" : "Login"}
          </BrutalButton>
        </BrutalCard>
        <Link href="/register" className="text-center text-sm font-black underline">
          Create account
        </Link>
      </form>
    </AppShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
