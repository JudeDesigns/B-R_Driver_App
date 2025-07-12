'use client';

import { useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDateTime, getStatusBadgeClass, getPaymentMethod } from "@/utils/routeUtils";

interface Stop {
  id: string;
  sequence: number;
  customerNameFromUpload: string | null;
  driverNameFromUpload: string | null;
  orderNumberWeb: string | null;
  quickbooksInvoiceNum: string | null;
  status: string;
  arrivalTime: string | null;
  completionTime: string | null;
  amount: number | null;
  driverPaymentAmount?: number;
  totalPaymentAmount?: number;
  driverPaymentMethods?: string[];
  paymentAmountCash?: number;
  paymentAmountCheck?: number;
  paymentAmountCC?: number;
  paymentFlagCash?: boolean;
  paymentFlagCheck?: boolean;
  paymentFlagCC?: boolean;
  paymentFlagNotPaid?: boolean;
  customer: {
    name: string;
  };
}

interface Route {
  id: string;
  stops: Stop[];
}

interface StopsTableProps {
  route: Route;
  groupByDriver: boolean;
  onToggleGrouping: () => void;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  getSortedStops: (stops: Stop[]) => Stop[];
  getStopsGroupedByDriver: () => Record<string, Stop[]>;
  editingSequence: string | null;
  tempSequence: number;
  onStartEditingSequence: (stopId: string, currentSequence: number) => void;
  onSaveSequence: (stopId: string) => void;
  onCancelEditingSequence: () => void;
  onTempSequenceChange: (value: number) => void;
  activeId: string | null;
  draggedStop: Stop | null;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  sensors: any;
}

export default function StopsTable({
  route,
  groupByDriver,
  onToggleGrouping,
  sortField,
  sortDirection,
  onSort,
  getSortedStops,
  getStopsGroupedByDriver,
  editingSequence,
  tempSequence,
  onStartEditingSequence,
  onSaveSequence,
  onCancelEditingSequence,
  onTempSequenceChange,
  activeId,
  draggedStop,
  onDragStart,
  onDragEnd,
  sensors
}: StopsTableProps) {
  
  const SortableStopRow = ({ stop }: { stop: Stop }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: stop.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <tr
        ref={setNodeRef}
        style={style}
        {...attributes}
        className={`hover:bg-gray-50 ${isDragging ? 'bg-blue-50' : ''}`}
      >
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          <div className="flex items-center">
            <button
              {...listeners}
              className="mr-2 p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </button>
            {editingSequence === stop.id ? (
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={tempSequence}
                  onChange={(e) => onTempSequenceChange(parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                  min="1"
                />
                <button
                  onClick={() => onSaveSequence(stop.id)}
                  className="text-green-600 hover:text-green-800"
                >
                  ✓
                </button>
                <button
                  onClick={onCancelEditingSequence}
                  className="text-red-600 hover:text-red-800"
                >
                  ✗
                </button>
              </div>
            ) : (
              <button
                onClick={() => onStartEditingSequence(stop.id, stop.sequence)}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                {stop.sequence}
              </button>
            )}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm font-medium text-gray-900">
            {stop.customerNameFromUpload || stop.customer?.name || "Unknown Customer"}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {stop.driverNameFromUpload || "Unassigned"}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {stop.orderNumberWeb || "N/A"}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {stop.quickbooksInvoiceNum || "N/A"}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(stop.status)}`}>
            {stop.status.replace("_", " ")}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${(stop.amount || 0).toFixed(2)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex flex-col">
            <div className="text-sm font-bold text-blue-600">
              ${(stop.driverPaymentAmount || stop.totalPaymentAmount || 0).toFixed(2)}
            </div>
            {stop.driverPaymentAmount && stop.driverPaymentAmount > 0 ? (
              <div className="text-xs text-green-600">
                {getPaymentMethod(stop)}
              </div>
            ) : (
              <div className="text-xs text-gray-500">
                {(stop.paymentAmountCash || 0) > 0 && `Cash: $${(stop.paymentAmountCash || 0).toFixed(2)}`}
                {(stop.paymentAmountCash || 0) > 0 && ((stop.paymentAmountCheck || 0) > 0 || (stop.paymentAmountCC || 0) > 0) && ', '}
                {(stop.paymentAmountCheck || 0) > 0 && `Check: $${(stop.paymentAmountCheck || 0).toFixed(2)}`}
                {(stop.paymentAmountCheck || 0) > 0 && (stop.paymentAmountCC || 0) > 0 && ', '}
                {(stop.paymentAmountCC || 0) > 0 && `CC: $${(stop.paymentAmountCC || 0).toFixed(2)}`}
              </div>
            )}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {formatDateTime(stop.arrivalTime)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {formatDateTime(stop.completionTime)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <Link
            href={`/admin/stops/${stop.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-900"
          >
            View Details
          </Link>
        </td>
      </tr>
    );
  };

  if (route.stops.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-900 text-white flex justify-between items-center">
          <h2 className="text-lg font-semibold">Stops (0)</h2>
        </div>
        <div className="p-6">
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No stops found</h3>
            <p className="mt-2 text-sm text-gray-500">
              This route doesn't have any stops yet. Add some stops to get started.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="px-6 py-4 bg-gray-900 text-white flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          Stops ({route.stops.length})
        </h2>
        <div className="flex items-center">
          <label className="inline-flex items-center cursor-pointer">
            <span className="mr-3 text-sm font-medium text-white">
              Group by Driver
            </span>
            <div className="relative">
              <input
                type="checkbox"
                checked={groupByDriver}
                onChange={onToggleGrouping}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </div>
          </label>
        </div>
      </div>
      <div className="p-6">
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => onSort('sequence')}
                  >
                    <div className="flex items-center">
                      Sequence
                      {sortField === 'sequence' && (
                        <span className="ml-1">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => onSort('customerNameFromUpload')}
                  >
                    <div className="flex items-center">
                      Customer
                      {sortField === 'customerNameFromUpload' && (
                        <span className="ml-1">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order #
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice #
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => onSort('status')}
                  >
                    <div className="flex items-center">
                      Status
                      {sortField === 'status' && (
                        <span className="ml-1">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => onSort('amount')}
                  >
                    <div className="flex items-center">
                      Amount
                      {sortField === 'amount' && (
                        <span className="ml-1">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => onSort('arrivalTime')}
                  >
                    <div className="flex items-center">
                      Arrival
                      {sortField === 'arrivalTime' && (
                        <span className="ml-1">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => onSort('completionTime')}
                  >
                    <div className="flex items-center">
                      Completion
                      {sortField === 'completionTime' && (
                        <span className="ml-1">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <SortableContext items={route.stops.map(stop => stop.id)} strategy={verticalListSortingStrategy}>
                  {getSortedStops(route.stops).map((stop) => (
                    <SortableStopRow key={stop.id} stop={stop} />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </div>
          <DragOverlay>
            {activeId && draggedStop ? (
              <div className="bg-white shadow-lg rounded-lg p-4 border-2 border-blue-500">
                <div className="font-medium text-gray-900">
                  {draggedStop.customerNameFromUpload || draggedStop.customer?.name || "Unknown Customer"}
                </div>
                <div className="text-sm text-gray-500">
                  Sequence: {draggedStop.sequence}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
