'use client';

import { useState, useEffect } from 'react';

export default function ClientDate() {
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    // Set the date only on the client side in PST timezone
    const updateDate = () => {
      setDate(new Date().toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
      }));
    };

    updateDate(); // Set initial date

    // Update the date every minute
    const interval = setInterval(updateDate, 60000);

    return () => clearInterval(interval);
  }, []);

  return <>{date}</>;
}
