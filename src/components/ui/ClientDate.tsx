'use client';

import { useState, useEffect } from 'react';

export default function ClientDate() {
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    // Set the date only on the client side
    setDate(new Date().toLocaleString());
    
    // Update the date every second
    const interval = setInterval(() => {
      setDate(new Date().toLocaleString());
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  return <>{date}</>;
}
