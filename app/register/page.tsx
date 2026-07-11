"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { useAuthStore } from "@/store/authStore";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("Anggita");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [validation, setValidation] = useState("");
  const register = useAuthStore((state) => state.register);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.includes("@")) return setValidation("Email must be valid.");
    if (password.length < 6) return setValidation("Password min 6 characters.");
    if (password !== confirm) return setValidation("Confirm password must match.");
    setValidation("");
    const ok = await register(displayName, email, password);
    if (ok) router.push("/home");
  };

  return (
    <AppShell withNav={false} className="grid place-items-center pb-4">
      <form onSubmit={submit} className="mx-auto grid w-full max-w-[560px] gap-4">
        <div>
          <p className="page-kicker">Join the noise</p>
          <h1 className="page-title">Create Maiabeat</h1>
        </div>
        <BrutalCard className="grid gap-3 bg-[#29FF87]">
          {[
            ["Name", displayName, setDisplayName, "text"],
            ["Email", email, setEmail, "email"],
            ["Password", password, setPassword, "password"],
            ["Confirm password", confirm, setConfirm, "password"],
          ].map(([placeholder, value, setter, type]) => (
            <input
              key={placeholder as string}
              value={value as string}
              onChange={(event) => (setter as (next: string) => void)(event.target.value)}
              type={type as string}
              required
              placeholder={placeholder as string}
              className="h-12 rounded-2xl border-[3px] border-black bg-white px-3 font-bold outline-none"
            />
          ))}
          {validation || error ? (
            <p className="text-sm font-black text-[#FF3B6B]">{validation || error}</p>
          ) : null}
          <BrutalButton type="submit" icon={<UserPlus size={18} />} disabled={loading}>
            {loading ? "Creating" : "Register"}
          </BrutalButton>
        </BrutalCard>
        <Link href="/login" className="text-center text-sm font-black underline">
          Already have account
        </Link>
      </form>
    </AppShell>
  );
}
