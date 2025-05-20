'use client';

import React from 'react';
import StatusButton from './StatusButton';

interface StatusUpdateSectionProps {
  status: string;
  updatingStatus: boolean;
  updateStatus: (status: string) => void;
  isStatusButtonDisabled: (status: string) => boolean;
}

export default function StatusUpdateSection({
  status,
  updatingStatus,
  updateStatus,
  isStatusButtonDisabled
}: StatusUpdateSectionProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h2 className="text-lg font-semibold mb-2">Status Update</h2>
      <div className="flex flex-col md:flex-row gap-2">
        <StatusButton
          status={status}
          targetStatus="ON_THE_WAY"
          currentStatus="PENDING"
          isUpdating={updatingStatus}
          isDisabled={isStatusButtonDisabled("ON_THE_WAY")}
          onClick={() => updateStatus("ON_THE_WAY")}
          label="Go"
          className="flex-1"
        />
        <StatusButton
          status={status}
          targetStatus="ARRIVED"
          currentStatus="ON_THE_WAY"
          isUpdating={updatingStatus}
          isDisabled={isStatusButtonDisabled("ARRIVED")}
          onClick={() => updateStatus("ARRIVED")}
          label="Arrived"
          className="flex-1"
        />
        <StatusButton
          status={status}
          targetStatus="COMPLETED"
          currentStatus="ARRIVED"
          isUpdating={updatingStatus}
          isDisabled={isStatusButtonDisabled("COMPLETED")}
          onClick={() => updateStatus("COMPLETED")}
          label="Complete Delivery"
          className="flex-1"
        />
      </div>
    </div>
  );
}
