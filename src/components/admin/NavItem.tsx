"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { NavColor, COLOR_CLASSES } from "./navColors";

export type { NavColor };

interface NavItemProps {
  href: string;
  label: string;
  color: NavColor;
  icon: ReactNode;
  indent?: boolean;
  matchPrefix?: boolean;
  onNavigate?: () => void;
  /** Use a smaller label size (matches the collapsed group header size). */
  compact?: boolean;
}

export default function NavItem({
  href,
  label,
  color,
  icon,
  indent = false,
  matchPrefix = false,
  onNavigate,
  compact = false,
}: NavItemProps) {
  const pathname = usePathname();
  const isActive =
    pathname === href || (matchPrefix && pathname.startsWith(`${href}/`));
  const { bar, icon: iconColor } = COLOR_CLASSES[color];

  return (
    <li>
      <Link
        href={href}
        className={`flex items-center py-2.5 px-4 ${
          indent ? "pl-12" : ""
        } text-white rounded-lg transition-all duration-300 relative overflow-hidden group ${
          isActive
            ? "bg-gradient-to-r from-gray-800 to-gray-700 shadow-md"
            : "hover:bg-gray-800"
        }`}
        onClick={onNavigate}
      >
        {isActive && (
          <span className={`absolute left-0 top-0 h-full w-1 ${bar}`}></span>
        )}
        <span
          className={`absolute inset-0 w-1 ${bar} transition-all duration-300 ${
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        ></span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`${indent ? "h-4 w-4" : "h-5 w-5"} mr-3 ${iconColor} transition-transform duration-300 ${
            isActive ? "scale-110" : "group-hover:scale-110"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {icon}
        </svg>
        <span
                className={`${
                  compact
                    ? "text-xs font-semibold uppercase tracking-wider"
                    : `font-medium ${indent ? "text-sm" : ""}`
                } transition-all duration-300 ${
                  isActive ? "text-white" : "group-hover:translate-x-1"
                }`}
              >
                {label}
              </span>
      </Link>
    </li>
  );
}
