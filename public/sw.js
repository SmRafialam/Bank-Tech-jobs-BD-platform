/* BankTech Jobs BD — service worker for Web Push notifications only (no offline caching). */
self.addEventListener("push", (event) => {
  let data = { title: "BankTech Jobs BD", body: "You have a new job alert.", url: "/notifications" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // ignore malformed payloads
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
      tag: data.url,
      badge: "/icon.svg",
      icon: "/icon.svg",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/notifications", self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === target.href && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
