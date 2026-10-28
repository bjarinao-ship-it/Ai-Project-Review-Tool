import React from 'react';

export default function StatusBadge({ status }) {
  const styles = {
    'Assigned': 'bg-blue-100 text-blue-800 border-blue-200',
    'In Progress': 'bg-amber-100 text-amber-800 border-amber-200',
    'Submitted': 'bg-purple-100 text-purple-800 border-purple-200',
    'Needs Revision': 'bg-rose-100 text-rose-800 border-rose-200',
    'Completed': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  };

  const currentStyle = styles[status] || 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${currentStyle}`}>
      {status}
    </span>
  );
}

