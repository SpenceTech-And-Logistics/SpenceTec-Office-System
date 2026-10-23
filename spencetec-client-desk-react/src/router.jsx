import React, { useEffect, useState } from "react";

// Tiny history router. The Worker already serves index.html for unknown paths.
const read = () => ({ path: location.pathname.replace(/\/+$/, "") || "/", query: new URLSearchParams(location.search) });

export function navigate(to, { replace = false } = {}) {
  if (to === location.pathname + location.search) return;
  history[replace ? "replaceState" : "pushState"](null, "", to);
  window.dispatchEvent(new Event("stc:nav"));
  if (!replace) window.scrollTo(0, 0);
}

export function useLocation() {
  const [loc, setLoc] = useState(read);
  useEffect(() => {
    const f = () => setLoc(read());
    window.addEventListener("popstate", f);
    window.addEventListener("stc:nav", f);
    return () => { window.removeEventListener("popstate", f); window.removeEventListener("stc:nav", f); };
  }, []);
  return loc;
}

export function setQuery(key, value) {
  const q = new URLSearchParams(location.search);
  if (value) q.set(key, value); else q.delete(key);
  const s = q.toString();
  navigate(location.pathname + (s ? "?" + s : ""), { replace: true });
}

export function Link({ to, onClick, children, ...rest }) {
  return (
    <a href={to} {...rest} onClick={(e) => {
      onClick?.(e);
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault(); navigate(to);
    }}>{children}</a>
  );
}
