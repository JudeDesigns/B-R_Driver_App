import React from 'react';

interface LinkifiedTextProps {
    text: string | null | undefined;
    className?: string;
}

export default function LinkifiedText({ text, className = 'whitespace-pre-wrap' }: LinkifiedTextProps) {
    if (!text) return null;

    // Regular expression to identify URLs
    // Matches http://, https://, or www. followed by valid characters
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;

    // Split text by URLs
    const parts = text.split(urlRegex);

    return (
        <span className={className}>
            {parts.map((part, index) => {
                if (part.match(urlRegex)) {
                    // If the part is a URL, render it as a link
                    const href = part.startsWith('www.') ? `https://${part}` : part;
                    return (
                        <a
                            key={index}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline break-all"
                            onClick={(e) => e.stopPropagation()} // Prevent triggering parent click handlers
                        >
                            {part}
                        </a>
                    );
                }
                // Otherwise render as regular text
                return <React.Fragment key={index}>{part}</React.Fragment>;
            })}
        </span>
    );
}
