'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Stop {
  id: string;
  sequence: number;
  customer: {
    name: string;
    address: string;
  };
  status: 'PENDING' | 'ON_THE_WAY' | 'ARRIVED' | 'COMPLETED';
  orderNumber?: string;
  qbInvoiceNumber?: string;
  initialDriverNotes?: string;
}

export default function DriverRoutePage() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // In a real implementation, this would fetch data from the API
    // For now, we'll just simulate loading with mock data
    const timer = setTimeout(() => {
      setLoading(false);
      // Mock data for demonstration
      setStops([
        {
          id: '1',
          sequence: 1,
          customer: {
            name: 'ABC Restaurant',
            address: '123 Main St, Anytown, USA',
          },
          status: 'PENDING',
          orderNumber: 'ORD-001',
          qbInvoiceNumber: 'INV-001',
          initialDriverNotes: 'Deliver to back entrance',
        },
        {
          id: '2',
          sequence: 2,
          customer: {
            name: 'XYZ Grocery',
            address: '456 Oak Ave, Somewhere, USA',
          },
          status: 'PENDING',
          orderNumber: 'ORD-002',
          qbInvoiceNumber: 'INV-002',
        },
      ]);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleStatusUpdate = async (stopId: string, newStatus: 'ON_THE_WAY' | 'ARRIVED') => {
    // In a real implementation, this would call the API to update the status
    // For now, we'll just update the local state
    setStops(stops.map(stop => 
      stop.id === stopId ? { ...stop, status: newStatus } : stop
    ));
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-20">
      <h1 className="text-2xl font-bold text-gray-800 text-center">Today's Route</h1>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      ) : stops.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No stops found</h3>
          <p className="mt-1 text-sm text-gray-500">
            You don't have any stops assigned for today.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {stops.map((stop) => (
            <div key={stop.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mr-2">
                    Stop {stop.sequence}
                  </span>
                  {stop.status === 'PENDING' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Pending
                    </span>
                  )}
                  {stop.status === 'ON_THE_WAY' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      On the Way
                    </span>
                  )}
                  {stop.status === 'ARRIVED' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      Arrived
                    </span>
                  )}
                  {stop.status === 'COMPLETED' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Completed
                    </span>
                  )}
                </div>
                {stop.status === 'PENDING' && (
                  <button
                    onClick={() => handleStatusUpdate(stop.id, 'ON_THE_WAY')}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-1 rounded transition duration-200"
                  >
                    Go
                  </button>
                )}
                {stop.status === 'ON_THE_WAY' && (
                  <button
                    onClick={() => handleStatusUpdate(stop.id, 'ARRIVED')}
                    className="bg-purple-500 hover:bg-purple-600 text-white text-sm px-3 py-1 rounded transition duration-200"
                  >
                    Arrived
                  </button>
                )}
                {stop.status === 'ARRIVED' && (
                  <Link
                    href={`/driver/stop/${stop.id}`}
                    className="bg-green-500 hover:bg-green-600 text-white text-sm px-3 py-1 rounded transition duration-200"
                  >
                    Complete
                  </Link>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-medium text-gray-900">{stop.customer.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{stop.customer.address}</p>
                
                {stop.orderNumber && (
                  <div className="mt-2 text-sm">
                    <span className="text-gray-500">Order #:</span>{' '}
                    <span className="text-gray-900">{stop.orderNumber}</span>
                  </div>
                )}
                
                {stop.qbInvoiceNumber && (
                  <div className="mt-1 text-sm">
                    <span className="text-gray-500">Invoice #:</span>{' '}
                    <span className="text-gray-900">{stop.qbInvoiceNumber}</span>
                  </div>
                )}
                
                {stop.initialDriverNotes && (
                  <div className="mt-3 p-2 bg-yellow-50 border-l-4 border-yellow-400 text-sm text-yellow-700">
                    <p className="font-medium">Note:</p>
                    <p>{stop.initialDriverNotes}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
