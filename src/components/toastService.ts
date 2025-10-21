interface Toast { id: number; title: string; description?: string; type?: "info" | "success" | "warning" | "error"; ttl?: number }
type Listener = (t: Toast) => void;

const listeners: Listener[] = [];

export function subscribeToast(fn: Listener) {
    listeners.push(fn);
    return () => {
        const idx = listeners.indexOf(fn);
        if (idx >= 0) listeners.splice(idx, 1);
    };
}

export function showToast(payload: Omit<Toast, "id">) {
    const t: Toast = { id: Date.now() ^ Math.floor(Math.random() * 1000), ...payload, ttl: payload.ttl ?? 6000 };
    listeners.slice().forEach((l) => l(t));
    return t.id;
}
