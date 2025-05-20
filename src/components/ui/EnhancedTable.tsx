"use client";

import React, { ReactNode } from "react";

export interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => ReactNode);
  align?: "left" | "center" | "right";
  width?: string;
  sortable?: boolean;
  renderCell?: (item: T) => ReactNode;
}

export interface BulkAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "primary" | "success" | "danger" | "warning";
  icon?: ReactNode;
  disabled?: boolean;
}

export interface EnhancedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: keyof T;
  isLoading?: boolean;
  emptyState?: ReactNode;
  onRowClick?: (item: T) => void;
  selectedRows?: (string | number)[];
  onSelectRow?: (id: string | number, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
  bulkActions?: BulkAction[];
  actionColumn?: boolean;
  stickyHeader?: boolean;
  striped?: boolean;
  compact?: boolean;
  className?: string;
  tableClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  rowClassName?: (item: T) => string;
}

export default function EnhancedTable<T>({
  data,
  columns,
  keyField,
  isLoading = false,
  emptyState,
  onRowClick,
  selectedRows = [],
  onSelectRow,
  onSelectAll,
  bulkActions = [],
  actionColumn = false,
  stickyHeader = false,
  striped = false,
  compact = false,
  className = "",
  tableClassName = "",
  headerClassName = "",
  bodyClassName = "",
  rowClassName = () => "",
}: EnhancedTableProps<T>) {
  const hasSelectionColumn = !!onSelectRow;

  // Check if all rows are selected
  const allSelected = data.length > 0 && selectedRows.length === data.length;

  // Handle row selection
  const handleSelectRow = (id: string | number, checked: boolean) => {
    if (onSelectRow) {
      onSelectRow(id, checked);
    }
  };

  // Handle select all
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSelectAll) {
      onSelectAll(e.target.checked);
    }
  };

  // Get button variant class
  const getButtonVariantClass = (variant?: string) => {
    if (!variant) return "bg-gray-200 hover:bg-gray-300 text-gray-800";

    switch (variant) {
      case "primary":
        return "bg-gray-800 text-white";
      case "success":
        return "bg-gray-800 text-white";
      case "danger":
        return "bg-gray-800 text-white";
      case "warning":
        return "bg-gray-800 text-white";
      default:
        return "bg-gray-800 text-white";
    }
  };

  return (
    <div
      className={`overflow-hidden rounded-lg shadow-sm border border-gray-200 ${className}`}
    >
      {/* Bulk Actions Bar */}
      {bulkActions.length > 0 && selectedRows.length > 0 && (
        <div className="bg-white px-6 py-4 border-b border-mono-200 flex justify-between items-center">
          <div className="text-sm font-medium text-mono-700">
            {selectedRows.length} {selectedRows.length === 1 ? "item" : "items"}{" "}
            selected
          </div>
          <div className="flex gap-3">
            {bulkActions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                disabled={action.disabled}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {action.icon && <span className="mr-2">{action.icon}</span>}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table
          className={`min-w-full divide-y divide-gray-200 ${tableClassName}`}
        >
          <thead
            className={`bg-gray-50 ${
              stickyHeader ? "sticky top-0 z-10" : ""
            } ${headerClassName}`}
          >
            <tr>
              {hasSelectionColumn && (
                <th scope="col" className="px-3 py-3.5 w-10">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary-blue focus:ring-primary-blue"
                      checked={allSelected}
                      onChange={handleSelectAll}
                    />
                  </div>
                </th>
              )}

              {columns.map((column, index) => (
                <th
                  key={index}
                  scope="col"
                  className={`px-3 py-3.5 text-${
                    column.align || "left"
                  } text-xs font-semibold text-gray-600 uppercase tracking-wider ${
                    compact ? "py-2" : ""
                  }`}
                  style={{ width: column.width }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody
            className={`bg-white divide-y divide-gray-200 ${bodyClassName}`}
          >
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length + (hasSelectionColumn ? 1 : 0)}
                  className="px-6 py-4 text-center text-sm text-gray-500"
                >
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue"></div>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (hasSelectionColumn ? 1 : 0)}
                  className="px-6 py-4 text-center text-sm text-gray-500"
                >
                  {emptyState || "No data available"}
                </td>
              </tr>
            ) : (
              data.map((item, rowIndex) => {
                const rowKey = String(item[keyField]);
                const isSelected = selectedRows.includes(rowKey);

                return (
                  <tr
                    key={rowKey}
                    className={`${
                      striped && rowIndex % 2 === 1 ? "bg-gray-50" : ""
                    } ${
                      onRowClick
                        ? "cursor-pointer hover:bg-gray-100"
                        : "hover:bg-gray-50"
                    } transition-colors duration-150 ${rowClassName(item)}`}
                    onClick={onRowClick ? () => onRowClick(item) : undefined}
                  >
                    {hasSelectionColumn && (
                      <td
                        className="px-3 py-4 w-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-primary-blue focus:ring-primary-blue"
                            checked={isSelected}
                            onChange={(e) =>
                              handleSelectRow(rowKey, e.target.checked)
                            }
                          />
                        </div>
                      </td>
                    )}

                    {columns.map((column, colIndex) => {
                      const cellContent =
                        typeof column.accessor === "function"
                          ? column.accessor(item)
                          : column.renderCell
                          ? column.renderCell(item)
                          : item[column.accessor];

                      return (
                        <td
                          key={colIndex}
                          className={`px-3 ${
                            compact ? "py-2" : "py-4"
                          } whitespace-nowrap text-sm ${
                            colIndex === 0
                              ? "font-medium text-gray-900"
                              : "text-gray-600"
                          } text-${column.align || "left"}`}
                        >
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
