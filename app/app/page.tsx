"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AppIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/chat");
  }, [router]);

  return null;
}
