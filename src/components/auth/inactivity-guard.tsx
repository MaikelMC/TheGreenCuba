"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/logout";

const INACTIVITY_LIMIT_MS = 3 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

export function InactivityGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/login" || pathname === "/register") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    function scheduleLogout() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!active) return;
        active = false;
        void logout();
      }, INACTIVITY_LIMIT_MS);
    }

    fetch("/api/me")
      .then((response) => response.json())
      .then((data: { authenticated?: boolean }) => {
        if (!active || !data.authenticated) return;
        scheduleLogout();
        for (const eventName of ACTIVITY_EVENTS) {
          window.addEventListener(eventName, scheduleLogout, { passive: true });
        }
      })
      .catch(() => {});

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, scheduleLogout);
      }
    };
  }, [pathname]);

  return null;
}
