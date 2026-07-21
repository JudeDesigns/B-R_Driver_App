"use client";

import { ReactNode } from "react";
import { NavColor, COLOR_CLASSES } from "./navColors";

interface NavGroupProps {
  id: string;
  label: string;
  icon: ReactNode;
  children: ReactNode;
  /** Color theme shared with this group's sub-items, to reinforce the grouping visually. */
  color: NavColor;
  /** Whether this group is currently expanded. Controlled by the parent so only one group can be open at a time. */
  open: boolean;
  /** Called when the user clicks the group header to toggle it open/closed. */
  onToggle: () => void;
}

export default function NavGroup({
  id,
  label,
  icon,
  children,
  color,
  open,
  onToggle,
}: NavGroupProps) {
  const { icon: iconColor, border, borderMuted, text } = COLOR_CLASSES[color];

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full flex items-center justify-between py-2.5 px-3 rounded-lg transition-all duration-300 group ${
          open ? `text-white bg-gray-800 border-l-2 ${border}` : "text-gray-300 hover:text-white hover:bg-gray-800 border-l-2 border-transparent"
        }`}
      >
        <span className="flex items-center min-w-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 mr-2 flex-shrink-0 transition-colors duration-300 ${iconColor} group-hover:text-white`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {icon}
          </svg>
          <span
            className={`text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${
              open ? text : ""
            }`}
          >
            {label}
          </span>
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 ml-2 flex-shrink-0 text-gray-400 group-hover:text-white transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <ul
          className={`mt-1 mb-1 space-y-1 border-l-2 ${borderMuted} ml-4 pl-2 py-1.5 bg-black/20 rounded-r-lg`}
        >
          {children}
        </ul>
      )}
    </li>
  );
}
