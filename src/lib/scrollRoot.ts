export function scrollRoot(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.getElementById("scroll-root");
}

export function scrollRootToTop() {
  scrollRoot()?.scrollTo({ top: 0 });
}

export function lockScrollRoot(): () => void {
  const el = scrollRoot();
  if (!el) return () => {};
  const prev = el.style.overflow;
  el.style.overflow = "hidden";
  return () => {
    el.style.overflow = prev;
  };
}
