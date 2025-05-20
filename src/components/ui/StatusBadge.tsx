'use client';

import React from 'react';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  className?: string;
  formatText?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-800',
  primary: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-purple-100 text-purple-800',
};

// Map common status values to variants
const statusVariantMap: Record<string, BadgeVariant> = {
  // Route statuses
  PENDING: 'warning',
  IN_PROGRESS: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  
  // Stop statuses
  ON_THE_WAY: 'info',
  ARRIVED: 'primary',
  FAILED: 'danger',
  
  // User roles
  ADMIN: 'primary',
  SUPER_ADMIN: 'danger',
  DRIVER: 'success',
};

export default function StatusBadge({ 
  status, 
  variant, 
  className = '',
  formatText = true,
}: StatusBadgeProps) {
  // Determine the variant to use
  const badgeVariant = variant || statusVariantMap[status] || 'default';
  
  // Format the status text (replace underscores with spaces and capitalize)
  const formattedStatus = formatText 
    ? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : status;
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[badgeVariant]} ${className}`}>
      {formattedStatus}
    </span>
  );
}
