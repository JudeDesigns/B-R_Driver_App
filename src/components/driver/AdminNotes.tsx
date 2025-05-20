'use client';

import React from 'react';

interface AdminNote {
  id: string;
  note: string;
  createdAt: string;
  admin: {
    id: string;
    username: string;
    fullName?: string;
  };
  readByDriver: boolean;
}

interface AdminNotesProps {
  notes: AdminNote[];
}

export default function AdminNotes({ notes }: AdminNotesProps) {
  if (notes.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Admin Notes</h2>
        <p className="text-gray-500 italic">No admin notes for this stop.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h2 className="text-lg font-semibold mb-2">Admin Notes</h2>
      <div className="space-y-3">
        {notes.map((note) => (
          <div 
            key={note.id} 
            className={`p-3 rounded-lg ${
              !note.readByDriver 
                ? 'bg-yellow-50 border-l-4 border-yellow-400' 
                : 'bg-gray-50'
            }`}
          >
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium">
                {note.admin.fullName || note.admin.username}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(note.createdAt).toLocaleString()}
              </p>
            </div>
            <p className="mt-1">{note.note}</p>
            {!note.readByDriver && (
              <div className="mt-1 text-xs text-yellow-600 font-medium">
                New note
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
