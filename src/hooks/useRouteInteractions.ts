import { useState } from "react";
import { useSensor, useSensors, PointerSensor } from "@dnd-kit/core";

interface Stop {
  id: string;
  sequence: number;
  customerNameFromUpload: string | null;
  amount: number | null;
  arrivalTime: string | null;
  completionTime: string | null;
  [key: string]: any;
}

/**
 * Custom hook for managing route interactions
 * Handles drag & drop, sorting, and sequence editing
 */
export function useRouteInteractions() {
  // Drag and Drop State
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedStop, setDraggedStop] = useState<Stop | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<string>('sequence');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Sequence editing state
  const [editingSequence, setEditingSequence] = useState<string | null>(null);
  const [tempSequence, setTempSequence] = useState<number>(0);

  // View state
  const [groupByDriver, setGroupByDriver] = useState(true);

  // Drag and Drop Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Sorting function
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort stops function
  const getSortedStops = (stops: Stop[]) => {
    return [...stops].sort((a, b) => {
      let aValue: any = a[sortField as keyof Stop];
      let bValue: any = b[sortField as keyof Stop];

      // Handle special cases
      if (sortField === 'customerNameFromUpload') {
        aValue = a.customerNameFromUpload || '';
        bValue = b.customerNameFromUpload || '';
      } else if (sortField === 'amount') {
        aValue = a.amount || 0;
        bValue = b.amount || 0;
      } else if (sortField === 'arrivalTime' || sortField === 'completionTime') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  };

  // Sequence editing functions
  const startEditingSequence = (stopId: string, currentSequence: number) => {
    setEditingSequence(stopId);
    setTempSequence(currentSequence);
  };

  const cancelEditingSequence = () => {
    setEditingSequence(null);
    setTempSequence(0);
  };

  return {
    // Drag and drop
    activeId,
    setActiveId,
    draggedStop,
    setDraggedStop,
    sensors,

    // Sorting
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    handleSort,
    getSortedStops,

    // Sequence editing
    editingSequence,
    setEditingSequence,
    tempSequence,
    setTempSequence,
    startEditingSequence,
    cancelEditingSequence,

    // View options
    groupByDriver,
    setGroupByDriver,
  };
}
