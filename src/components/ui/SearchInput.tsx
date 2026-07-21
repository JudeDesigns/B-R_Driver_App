import React, { useState, useEffect, useRef } from "react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceTime?: number;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
  debounceTime = 300,
}: SearchInputProps) {
  const [inputValue, setInputValue] = useState(value);
  // Tracks the last value we emitted via onChange, so we can tell whether an
  // incoming `value` prop change was caused by our own debounced update
  // (in which case we must NOT overwrite what the user is currently typing)
  // or by something external (e.g. a parent-triggered reset/clear).
  const lastEmittedValue = useRef(value);

  // Only resync local state when the prop changes for a reason other than
  // our own debounced emit. Resyncing unconditionally caused typed
  // characters to be wiped mid-keystroke (most noticeable on Windows/slower
  // re-renders).
  useEffect(() => {
    if (value !== lastEmittedValue.current) {
      setInputValue(value);
      lastEmittedValue.current = value;
    }
  }, [value]);

  // Debounce the onChange callback
  useEffect(() => {
    const handler = setTimeout(() => {
      if (inputValue !== value) {
        lastEmittedValue.current = inputValue;
        onChange(inputValue);
      }
    }, debounceTime);

    return () => {
      clearTimeout(handler);
    };
  }, [inputValue, value, onChange, debounceTime]);

  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <svg
          className="w-4 h-4 text-gray-500"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 20 20"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
          />
        </svg>
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="block w-full p-2 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-transparent"
        placeholder={placeholder}
      />
      {inputValue && (
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex items-center pr-3"
          onClick={() => {
            setInputValue("");
            lastEmittedValue.current = "";
            onChange("");
          }}
        >
          <svg
            className="w-4 h-4 text-gray-500 hover:text-gray-900"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
