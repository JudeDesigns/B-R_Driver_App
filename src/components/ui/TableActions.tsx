'use client';

import React from 'react';
import Link from 'next/link';

export interface Action {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning';
  disabled?: boolean;
}

interface TableActionsProps {
  actions: Action[];
  align?: 'left' | 'center' | 'right';
  className?: string;
}

const variantClasses = {
  default: 'text-gray-600 hover:text-gray-900',
  primary: 'text-primary-blue hover:text-blue-700',
  success: 'text-green-600 hover:text-green-800',
  danger: 'text-red-600 hover:text-red-800',
  warning: 'text-yellow-600 hover:text-yellow-800',
};

export default function TableActions({ 
  actions, 
  align = 'right',
  className = '' 
}: TableActionsProps) {
  const alignmentClass = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }[align];

  return (
    <div className={`flex items-center space-x-3 ${alignmentClass} ${className}`}>
      {actions.map((action, index) => {
        const variantClass = variantClasses[action.variant || 'default'];
        
        if (action.href) {
          return (
            <Link
              key={index}
              href={action.href}
              className={`inline-flex items-center ${variantClass} transition duration-200 ${
                action.disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={(e) => {
                if (action.disabled) {
                  e.preventDefault();
                } else if (action.onClick) {
                  action.onClick();
                }
              }}
            >
              {action.icon && <span className="mr-1">{action.icon}</span>}
              {action.label}
            </Link>
          );
        }
        
        return (
          <button
            key={index}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`inline-flex items-center ${variantClass} transition duration-200 ${
              action.disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {action.icon && <span className="mr-1">{action.icon}</span>}
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
