"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string;
  options: Option[];
  paramKey: string;
  activeParams: Record<string, string>;
}

function buildHref(activeParams: Record<string, string>, paramKey: string, optionValue: string): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(activeParams)) {
    if (v && v !== "all") next.set(k, v);
  }
  if (optionValue && optionValue !== "all") next.set(paramKey, optionValue);
  else next.delete(paramKey);
  const qs = next.toString();
  return `/orders${qs ? `?${qs}` : ""}`;
}

export function HeaderDropdown({ label, value, options, paramKey, activeParams }: Props) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const isFiltered = value !== "all";

  function handleToggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((o) => !o);
  }

  function handleSelect(optValue: string) {
    setOpen(false);
    router.push(buildHref(activeParams, paramKey, optValue));
  }

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className={`flex items-center gap-1 cursor-pointer select-none ${isFiltered ? "text-indigo-600" : ""}`}
      >
        {label}
        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="bg-white border border-gray-200 rounded-md shadow-lg z-[9999] min-w-[140px] py-1"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                opt.value === value ? "text-indigo-600 font-medium" : "text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
