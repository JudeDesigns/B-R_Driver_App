import React from "react";

interface TableColumn<T> {
  header: React.ReactNode;
  accessor: ((item: T) => React.ReactNode) | keyof T;
  align?: "left" | "center" | "right";
  width?: string;
}

interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  striped?: boolean;
  stickyHeader?: boolean;
  onRowClick?: (item: T) => void;
  className?: string;
}

export default function Table<T>({
  data,
  columns,
  striped = false,
  stickyHeader = false,
  onRowClick,
  className = "",
}: TableProps<T>) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200 table-fixed">
        <thead className={stickyHeader ? "sticky top-0 bg-white z-10" : ""}>
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                scope="col"
                className={`px-6 py-3 text-xs font-medium tracking-wider ${
                  column.align === "center"
                    ? "text-center"
                    : column.align === "right"
                    ? "text-right"
                    : "text-left"
                } text-gray-500 uppercase`}
                style={
                  column.width
                    ? { width: column.width, maxWidth: column.width }
                    : undefined
                }
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item, rowIndex) => (
            <tr
              key={rowIndex}
              className={`${
                striped && rowIndex % 2 === 1 ? "bg-gray-50" : ""
              } ${onRowClick ? "cursor-pointer hover:bg-gray-100" : ""}`}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
            >
              {columns.map((column, colIndex) => (
                <td
                  key={colIndex}
                  className={`px-6 py-4 text-sm ${
                    column.align === "center"
                      ? "text-center"
                      : column.align === "right"
                      ? "text-right"
                      : "text-left"
                  } ${
                    colIndex === 0
                      ? "font-medium text-gray-900"
                      : "text-gray-500"
                  }`}
                  style={
                    column.width
                      ? { width: column.width, maxWidth: column.width }
                      : undefined
                  }
                >
                  {typeof column.accessor === "function"
                    ? column.accessor(item)
                    : (item[column.accessor as keyof T] as React.ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
