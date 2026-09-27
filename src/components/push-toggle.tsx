"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Registers the service worker and stores the Web Push subscription on the server. */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [status, setStatus] = useState<"unsupported" | "idle" | "subscribed" | "denied" | "working">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Browser capabilities are only known on the client; resolve them asynchronously after hydration.
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !publicKey) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration("/sw.js").catch(() => undefined);
      const sub = await reg?.pushManager.getSubscription().catch(() => null);
      if (sub && !cancelled) setStatus("subscribed");
    })();
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  async function subscribe() {
    setStatus("working");
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey!) });
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setStatus("subscribed");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("idle");
    }
  }

  async function unsubscribe() {
    setStatus("working");
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setStatus("idle");
  }

  if (status === "unsupported") {
    return <p className="text-sm text-slate-500">Browser push is not available (unsupported browser or VAPID keys not configured on the server).</p>;
  }
  if (status === "denied") return <p className="text-sm text-amber-800">Notifications are blocked in your browser settings for this site.</p>;
  return (
    <div className="flex flex-col gap-2">
      {status === "subscribed" ? (
        <Button type="button" variant="outline" onClick={unsubscribe}>
          Disable browser notifications on this device
        </Button>
      ) : (
        <Button type="button" variant="outline" onClick={subscribe} disabled={status === "working"}>
          Enable browser notifications on this device
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
