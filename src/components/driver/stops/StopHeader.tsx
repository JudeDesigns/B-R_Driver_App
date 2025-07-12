'use client';

import { useRouter } from "next/navigation";
import StatusBadge from "@/components/ui/StatusBadge";

interface Stop {
  id: string;
  status: string;
}

interface StopHeaderProps {
  stop: Stop | null;
}

export default function StopHeader({ stop }: StopHeaderProps) {
  const router = useRouter();

  return (
    <div className="bg-white shadow-md rounded-lg mb-6 sticky top-0 z-10">
      <div className="p-4 flex items-center justify-between">
        <button
          onClick={() => router.push("/driver/stops")}
          className="flex items-center text-gray-600 hover:text-black transition-colors touch-manipulation tap-target"
          aria-label="Back to stops list"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-1"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          <span className="hidden sm:inline">Back</span>
          <span className="sm:hidden">Back</span>
        </button>
        {stop && (
          <StatusBadge status={stop.status} className="text-sm px-3 py-1" />
        )}
      </div>
    </div>
  );
}
