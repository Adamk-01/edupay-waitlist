"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";

const NAV_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#about", label: "About EduPay" },
  { href: "#services", label: "Services" },
  { href: "#faqs", label: "FAQs" }
];

/**
 * Site header and navigation.
 *
 * Below 700px the desktop links and the header CTA are hidden by CSS. They used
 * to be replaced by a hamburger that was really just an anchor to the form, so
 * on a phone there was no way to reach Home / About / Services / FAQs at all.
 * This is the real menu: the button owns the expanded state, Escape closes it
 * and returns focus, a click outside closes it, and the panel is removed from
 * the accessibility tree while closed.
 */
export function SiteNav() {
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    }

    function onPointerDown(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <header className="site-header" ref={headerRef}>
      <div className="container nav-wrap">
        <Logo light />

        <nav className="desktop-nav" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className={link.href === "#home" ? "active" : undefined}>
              {link.label}
            </a>
          ))}
        </nav>

        <a className="button button-primary nav-cta" href="#join">
          Join the Waitlist <ArrowRight size={16} aria-hidden="true" />
        </a>

        <button
          type="button"
          ref={toggleRef}
          className="nav-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </div>

      <div className="mobile-panel" id={panelId} hidden={!open}>
        <nav aria-label="Mobile navigation">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <a className="button button-primary" href="#join" onClick={() => setOpen(false)}>
            Join the Waitlist
          </a>
        </nav>
      </div>
    </header>
  );
}
