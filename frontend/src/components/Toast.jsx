import React, { useState, useEffect } from 'react';

export default function Toast({ message, isError }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFading(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`px-4 py-3 rounded-lg border-l-4 shadow-lg max-w-sm transition-opacity duration-300 ${
        fading ? 'opacity-0' : 'opacity-100'
      } ${isError ? 'border-red-500 bg-navy-700' : 'border-green-500 bg-navy-700'}`}
    >
      <span className="text-sm text-gray-200">{message}</span>
    </div>
  );
}
