"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("kot_access_token");
    if (token) {
      router.push("/restaurant/pos");
    } else {
      router.push("/login");
    }
  }, [router]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 text-slate-500 gap-2 font-sans">
      <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-semibold">Redirecting to Restaurant POS...</span>
    </div>
  );
}
