'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface StopOption {
  stopId: string;
  customerId: string;
  invoiceNum: string;
  customerName: string;
  routeNumber: string;
  sequence: number;
  routeDate: string;
}

interface CustomerOption {
  customerId: string;
  customerName: string;
  groupCode: string | null;
}

type ScanStatus = 'MATCHED' | 'AMBIGUOUS' | 'NEEDS_ASSIGNMENT';

interface ScanResult {
  fileName: string;
  fileSize: number;
  status: ScanStatus;
  matchedBy?: 'invoice' | 'customer_name';
  extractedNumber?: string;
  triedNumbers: string[];
  nameTokens: string[];
  docTypeHint: 'INVOICE' | 'CREDIT_MEMO' | 'STATEMENT' | 'PURCHASE_ORDER' | null;
  reason?: string;
  resolvedTo?: StopOption;
  stopCandidates?: StopOption[];
  customerCandidates?: CustomerOption[];
}

type AttachMode = 'stop' | 'customer';

interface FileRow {
  id: string;
  file: File;
  scanResult: ScanResult;
  attachMode: AttachMode;
  assignedStop: StopOption | null;
  assignedCustomer: CustomerOption | null;
  docType: string;
  referenceNumber: string;
  excluded: boolean;
  searchQuery: string;
  searchResults: StopOption[];
  customerResults: CustomerOption[];
  isSearching: boolean;
  showDropdown: boolean;
}

// Doc types whose reference number syncs back to the Stop record.
const REF_NUMBER_TYPES = new Set(['INVOICE', 'CREDIT_MEMO', 'PURCHASE_ORDER']);

const DOC_TYPES = [
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'CREDIT_MEMO', label: 'Credit Memo' },
  { value: 'PURCHASE_ORDER', label: 'Purchase Order' },
  { value: 'STATEMENT', label: 'Statement' },
  { value: 'RETURN_FORM', label: 'Return Form' },
  { value: 'OTHER', label: 'Other' },
];

// Map parser hint → enum value used by the Document model.
const HINT_TO_DOCTYPE: Record<string, string> = {
  INVOICE: 'INVOICE',
  CREDIT_MEMO: 'CREDIT_MEMO',
  STATEMENT: 'STATEMENT',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles',
  });
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${['B', 'KB', 'MB'][i]}`;
}

function buildRow(file: File, scan: ScanResult): FileRow {
  const defaultType = scan.docTypeHint ? HINT_TO_DOCTYPE[scan.docTypeHint] : 'INVOICE';
  // Pre-populate reference number: prefer the number that produced the match,
  // else fall back to the longest candidate number found in the filename.
  const referenceNumber =
    scan.extractedNumber || (scan.triedNumbers && scan.triedNumbers[0]) || '';
  return {
    id: `${file.name}-${Math.random()}`,
    file,
    scanResult: scan,
    attachMode: 'stop',
    assignedStop: scan.resolvedTo ?? null,
    assignedCustomer: null,
    docType: defaultType,
    referenceNumber,
    excluded: false,
    searchQuery: scan.resolvedTo
      ? `${scan.resolvedTo.customerName} — Inv ${scan.resolvedTo.invoiceNum}`
      : '',
    searchResults: [],
    customerResults: [],
    isSearching: false,
    showDropdown: false,
  };
}

export default function DocumentIntakePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [phase, setPhase] = useState<'upload' | 'review'>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [dateScope, setDateScope] = useState(1);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [commitErrors, setCommitErrors] = useState<Array<{ fileName: string; error: string }>>([]);
  const [commitSkipped, setCommitSkipped] = useState<Array<{ fileName: string; reason: string }>>([]);

  // History panel state
  interface HistoryLog {
    id: string;
    fileName: string;
    fileSize: number;
    status: 'MATCHED' | 'UNMATCHED' | 'MANUAL_RESOLVED';
    flow: string | null;
    docType: string | null;
    resolvedToId: string | null;
    errorMessage: string | null;
    createdAt: string;
  }
  interface HistoryBatch {
    id: string;
    status: string;
    totalFiles: number;
    matchedCount: number;
    unmatchedCount: number;
    createdAt: string;
    user: { fullName: string | null; username: string } | null;
    logs: HistoryLog[];
  }
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBatches, setHistoryBatches] = useState<HistoryBatch[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/documents/intake?type=history&limit=20', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryBatches(data.batches || []);
      }
    } catch {
      // silent — panel will just show empty
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const toggleHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) void loadHistory();
  };

  // Dedup incoming files by name — keeps the first occurrence only.
  const dedupFiles = (incoming: File[], existing: File[]): { files: File[]; duplicates: string[] } => {
    const seen = new Set(existing.map((f) => f.name));
    const duplicates: string[] = [];
    const unique: File[] = [];
    for (const f of incoming) {
      if (seen.has(f.name)) {
        duplicates.push(f.name);
      } else {
        seen.add(f.name);
        unique.push(f);
      }
    }
    return { files: [...existing, ...unique], duplicates };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const { files: merged, duplicates } = dedupFiles(Array.from(e.target.files), []);
    setFiles(merged);
    setError(duplicates.length ? `Skipped duplicate filename(s): ${duplicates.join(', ')}` : '');
    setSuccess('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.files) return;
    const { files: merged, duplicates } = dedupFiles(Array.from(e.dataTransfer.files), files);
    setFiles(merged);
    setError(duplicates.length ? `Skipped duplicate filename(s): ${duplicates.join(', ')}` : '');
    setSuccess('');
  };

  const handleScan = async () => {
    if (files.length === 0) { setError('Please select files first.'); return; }
    setIsScanning(true); setError('');
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('dryRun', 'true');
      fd.append('dateScope', String(dateScope));
      files.forEach((f) => fd.append('files', f));
      const res = await fetch('/api/admin/documents/intake', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Scan failed');
      const data = await res.json();
      const fileMap = new Map(files.map((f) => [f.name, f]));
      setRows(data.results.map((scan: ScanResult) => buildRow(fileMap.get(scan.fileName)!, scan)));
      setPhase('review');
    } catch (err: any) {
      setError(err.message || 'Scan failed. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const updateRow = useCallback((id: string, patch: Partial<FileRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const handleDocTypeChange = (id: string, docType: string) => updateRow(id, { docType });
  const handleReferenceNumberChange = (id: string, referenceNumber: string) =>
    updateRow(id, { referenceNumber });
  const handleToggleExclude = (id: string, excluded: boolean) => updateRow(id, { excluded });

  const handleSelectStop = (id: string, stop: StopOption) => {
    updateRow(id, {
      attachMode: 'stop',
      assignedStop: stop,
      assignedCustomer: null,
      searchQuery: `${stop.customerName} — Inv ${stop.invoiceNum || '—'}`,
      showDropdown: false,
      searchResults: [],
      customerResults: [],
    });
  };

  const handleSelectCustomer = (id: string, customer: CustomerOption) => {
    updateRow(id, {
      attachMode: 'customer',
      assignedStop: null,
      assignedCustomer: customer,
      searchQuery: `${customer.customerName}${customer.groupCode ? ` (${customer.groupCode})` : ''}`,
      showDropdown: false,
      searchResults: [],
      customerResults: [],
    });
  };

  const handleToggleAttachMode = (id: string, mode: AttachMode) => {
    updateRow(id, {
      attachMode: mode,
      assignedStop: null,
      assignedCustomer: null,
      searchQuery: '',
      searchResults: [],
      customerResults: [],
      showDropdown: false,
    });
  };

  const handleSearchChange = (id: string, query: string, mode: AttachMode) => {
    updateRow(id, {
      searchQuery: query,
      showDropdown: true,
      assignedStop: null,
      assignedCustomer: null,
    });
    clearTimeout(searchTimers.current[id]);
    if (query.trim().length < 2) {
      updateRow(id, { searchResults: [], customerResults: [], isSearching: false });
      return;
    }
    updateRow(id, { isSearching: true });
    searchTimers.current[id] = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const url = mode === 'customer'
          ? `/api/admin/documents/intake?type=customer&q=${encodeURIComponent(query)}`
          : `/api/admin/documents/intake?q=${encodeURIComponent(query)}&dateScope=${dateScope}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (mode === 'customer') {
          updateRow(id, { customerResults: data.customers || [], searchResults: [], isSearching: false });
        } else {
          updateRow(id, { searchResults: data.stops || [], customerResults: [], isSearching: false });
        }
      } catch {
        updateRow(id, { isSearching: false });
      }
    }, 350);
  };

  const activeRows = rows.filter((r) => !r.excluded);
  const resolvedRows = activeRows.filter(
    (r) => (r.attachMode === 'stop' ? !!r.assignedStop : !!r.assignedCustomer)
  );
  const pendingRows = activeRows.filter(
    (r) => (r.attachMode === 'stop' ? !r.assignedStop : !r.assignedCustomer)
  );
  // Allow partial commit: approve the resolved ones now, keep the rest for later.
  const canCommit = resolvedRows.length > 0;

  const handleCommit = async () => {
    if (!canCommit) return;
    const pendingNote = pendingRows.length
      ? ` ${pendingRows.length} unresolved file(s) will be kept for review.`
      : '';
    if (!confirm(`Commit ${resolvedRows.length} assigned document(s)?${pendingNote}`)) return;
    setIsCommitting(true);
    setError('');
    setCommitErrors([]);
    setCommitSkipped([]);
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('dryRun', 'false');
      fd.append('dateScope', String(dateScope));
      resolvedRows.forEach((r) => fd.append('files', r.file));
      const assignments = resolvedRows.map((r) => ({
        fileName: r.file.name,
        stopId: r.attachMode === 'stop' ? r.assignedStop!.stopId : null,
        customerId: r.attachMode === 'stop' ? r.assignedStop!.customerId : r.assignedCustomer!.customerId,
        docType: r.docType,
        // Only send a reference number when it is meaningful (stop-level
        // INVOICE / CREDIT_MEMO / PURCHASE_ORDER). Customer-only attachments
        // and non-reference types ignore this field on the server.
        referenceNumber:
          r.attachMode === 'stop' && REF_NUMBER_TYPES.has(r.docType)
            ? (r.referenceNumber || '').trim()
            : '',
      }));
      fd.append('assignments', JSON.stringify(assignments));
      const res = await fetch('/api/admin/documents/intake', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Commit failed');
      const data = await res.json();
      setCommitErrors(data.errors || []);
      setCommitSkipped(data.skippedList || []);
      const parts: string[] = [];
      if (data.committed) parts.push(`${data.committed} uploaded`);
      if (data.skipped) parts.push(`${data.skipped} skipped as duplicate`);
      if (data.failed) parts.push(`${data.failed} failed`);
      setSuccess(parts.join(' · ') || 'Nothing committed.');

      // Remove successfully-committed and skipped (already-present) rows; keep
      // failures for retry and unresolved rows for further review.
      const errored = new Set<string>((data.errors || []).map((e: any) => e.fileName));
      const sentFileNames = new Set(resolvedRows.map((r) => r.file.name));
      setRows((prev) => prev.filter((r) => !sentFileNames.has(r.file.name) || errored.has(r.file.name)));
      setFiles((prev) => prev.filter((f) => !sentFileNames.has(f.name) || errored.has(f.name)));

      // Refresh history so the new batch shows immediately if the panel is open.
      if (historyOpen) void loadHistory();
    } catch (err: any) {
      setError(err.message || 'Commit failed. Please try again.');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Batch Document Intake</h1>
          <p className="text-gray-500 text-sm mt-1">
            Drop any files — the system matches by invoice number or customer name. Ambiguous
            or unknown files are flagged for manual assignment. Credit memos and customer-only
            documents are supported.
          </p>
        </div>
        <button onClick={() => router.push('/admin/document-management')}
          className="text-sm text-gray-500 hover:text-gray-900 font-medium">
          Back to Documents
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm font-medium">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 text-sm font-medium">{success}</p>
        </div>
      )}
      {commitErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-1">
          <p className="text-red-800 text-sm font-semibold">Failed to commit {commitErrors.length} file(s):</p>
          <ul className="text-red-700 text-xs list-disc pl-5 space-y-0.5">
            {commitErrors.map((e, i) => (
              <li key={i}><span className="font-medium">{e.fileName}</span> — {e.error}</li>
            ))}
          </ul>
        </div>
      )}
      {commitSkipped.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-1">
          <p className="text-yellow-800 text-sm font-semibold">Skipped {commitSkipped.length} duplicate(s):</p>
          <ul className="text-yellow-700 text-xs list-disc pl-5 space-y-0.5">
            {commitSkipped.map((e, i) => (
              <li key={i}><span className="font-medium">{e.fileName}</span> — {e.reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Upload Phase ─────────────────────────────────────────────────────── */}
      {phase === 'upload' && (
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">

          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg p-10 text-center transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              {files.length === 0 ? (
                <>
                  <p className="text-gray-600 font-medium">Click to select files or drag and drop</p>
                  <p className="text-gray-400 text-sm mt-1">PDF, JPG, PNG, DOC (no renaming required)</p>
                </>
              ) : (
                <>
                  <p className="text-gray-900 font-semibold">{files.length} file(s) selected</p>
                  <p className="text-gray-400 text-sm mt-1">Click to change selection</p>
                </>
              )}
            </label>
          </div>

          {/* Selected file list */}
          {files.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className="flex justify-between text-sm px-3 py-1.5 bg-gray-50 rounded">
                  <span className="text-gray-700 truncate flex-1">{f.name}</span>
                  <span className="text-gray-400 ml-4 shrink-0">{formatSize(f.size)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Scope</label>
              <select
                value={dateScope}
                onChange={(e) => setDateScope(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value={1}>Today only</option>
                <option value={2}>Today + yesterday</option>
                <option value={3}>Last 3 days</option>
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
              </select>
            </div>
            <button
              onClick={handleScan}
              disabled={isScanning || files.length === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
            >
              {isScanning ? 'Scanning...' : 'Scan Files'}
            </button>
          </div>
        </div>
      )}

      {/* ── Review Phase ─────────────────────────────────────────────────────── */}
      {phase === 'review' && (
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">

          {/* Summary bar */}
          <div className="flex items-center justify-between">
            <div className="flex gap-6 text-sm flex-wrap">
              <span className="text-green-700 font-medium">
                {rows.filter((r) => !r.excluded && r.scanResult.status === 'MATCHED').length} auto-matched
              </span>
              <span className="text-amber-600 font-medium">
                {rows.filter((r) => !r.excluded && r.scanResult.status === 'AMBIGUOUS').length} ambiguous
              </span>
              <span className="text-orange-600 font-medium">
                {rows.filter((r) => !r.excluded && r.scanResult.status === 'NEEDS_ASSIGNMENT').length} need assignment
              </span>
              <span className="text-gray-400">
                {rows.filter((r) => r.excluded).length} excluded
              </span>
            </div>
            <button
              onClick={() => { setPhase('upload'); setRows([]); setCommitErrors([]); setCommitSkipped([]); }}
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Scan again
            </button>
          </div>

          {pendingRows.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 text-sm text-orange-700">
              {pendingRows.length} file(s) still need a target (stop or customer) assigned before you can commit.
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">File</th>
                  <th className="px-4 py-3 text-left">Attach To</th>
                  <th className="px-4 py-3 text-left">Document Type</th>
                  <th className="px-4 py-3 text-left"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, rowIndex) => {
                  const isAssigned = row.attachMode === 'stop' ? !!row.assignedStop : !!row.assignedCustomer;
                  const rowClass = row.excluded
                    ? 'bg-gray-50 opacity-50'
                    : isAssigned
                    ? 'bg-green-50'
                    : row.scanResult.status === 'AMBIGUOUS'
                    ? 'bg-amber-50'
                    : 'bg-orange-50';
                  // Flip the dropdown upward for the last 2 rows (and for
                  // single-row tables) so the table's overflow container
                  // doesn't clip it.
                  const flipUp = rowIndex >= rows.length - 2;
                  const dropdownPos = flipUp
                    ? 'bottom-full mb-1'
                    : 'top-full mt-1';
                  return (
                  <tr key={row.id} className={rowClass}>
                    {/* File info */}
                    <td className="px-4 py-3 max-w-[240px]">
                      <p className="font-medium text-gray-800 truncate">{row.file.name}</p>
                      <p className="text-gray-400 text-xs">{formatSize(row.file.size)}</p>
                      {row.scanResult.status === 'MATCHED' && row.scanResult.matchedBy === 'invoice' && row.scanResult.extractedNumber && (
                        <p className="text-green-600 text-xs mt-0.5">Matched on invoice {row.scanResult.extractedNumber}</p>
                      )}
                      {row.scanResult.status === 'MATCHED' && row.scanResult.matchedBy === 'customer_name' && (
                        <p className="text-green-600 text-xs mt-0.5">Matched on customer name</p>
                      )}
                      {row.scanResult.status === 'AMBIGUOUS' && row.scanResult.reason && (
                        <p className="text-amber-600 text-xs mt-0.5">{row.scanResult.reason}</p>
                      )}
                      {row.scanResult.status === 'NEEDS_ASSIGNMENT' && (
                        <p className="text-orange-500 text-xs mt-0.5">{row.scanResult.reason || 'Assign manually'}</p>
                      )}
                      {row.scanResult.docTypeHint && (
                        <p className="text-gray-500 text-xs mt-0.5">Detected: {row.scanResult.docTypeHint.replace('_', ' ').toLowerCase()}</p>
                      )}
                    </td>

                    {/* Attach target */}
                    <td className="px-4 py-3 min-w-[300px]">
                      {!row.excluded && (
                        <div className="space-y-1.5">
                          {/* Mode toggle */}
                          <div className="flex gap-1 text-xs">
                            <button
                              onClick={() => handleToggleAttachMode(row.id, 'stop')}
                              className={`px-2 py-0.5 rounded ${row.attachMode === 'stop' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                              Stop
                            </button>
                            <button
                              onClick={() => handleToggleAttachMode(row.id, 'customer')}
                              className={`px-2 py-0.5 rounded ${row.attachMode === 'customer' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                              Customer only
                            </button>
                          </div>

                          {/* Ambiguous quick-pick candidates */}
                          {!isAssigned && row.scanResult.status === 'AMBIGUOUS' && row.attachMode === 'stop' && row.scanResult.stopCandidates && row.scanResult.stopCandidates.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {row.scanResult.stopCandidates.map((s) => (
                                <button
                                  key={s.stopId}
                                  onClick={() => handleSelectStop(row.id, s)}
                                  className="text-xs bg-white border border-amber-300 hover:border-amber-500 rounded px-2 py-1 text-gray-800"
                                >
                                  {s.customerName} · R{s.routeNumber} #{s.sequence} {s.invoiceNum ? `· Inv ${s.invoiceNum}` : ''}
                                </button>
                              ))}
                            </div>
                          )}
                          {!isAssigned && row.scanResult.status === 'AMBIGUOUS' && row.attachMode === 'customer' && row.scanResult.customerCandidates && row.scanResult.customerCandidates.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {row.scanResult.customerCandidates.map((c) => (
                                <button
                                  key={c.customerId}
                                  onClick={() => handleSelectCustomer(row.id, c)}
                                  className="text-xs bg-white border border-amber-300 hover:border-amber-500 rounded px-2 py-1 text-gray-800"
                                >
                                  {c.customerName}{c.groupCode ? ` (${c.groupCode})` : ''}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Search input */}
                          <div className="relative">
                            <input
                              type="text"
                              placeholder={row.attachMode === 'stop'
                                ? 'Search by customer, invoice, or route…'
                                : 'Search customer by name or group code…'}
                              value={row.searchQuery}
                              onChange={(e) => handleSearchChange(row.id, e.target.value, row.attachMode)}
                              onFocus={() => updateRow(row.id, { showDropdown: true })}
                              onBlur={() => setTimeout(() => updateRow(row.id, { showDropdown: false }), 200)}
                              className={`w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                                isAssigned ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-white'
                              }`}
                            />
                            {row.showDropdown && (row.isSearching || row.searchResults.length > 0 || row.customerResults.length > 0) && (
                              <div className={`absolute z-50 left-0 right-0 ${dropdownPos} bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto`}>
                                {row.isSearching && (
                                  <div className="px-3 py-2 text-gray-400 text-sm">Searching…</div>
                                )}
                                {!row.isSearching && row.attachMode === 'stop' && row.searchResults.map((stop) => (
                                  <button
                                    key={stop.stopId}
                                    onMouseDown={() => handleSelectStop(row.id, stop)}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0"
                                  >
                                    <p className="font-medium text-gray-800 text-sm">{stop.customerName}</p>
                                    <p className="text-gray-500 text-xs">
                                      Route {stop.routeNumber} · Stop #{stop.sequence}
                                      {stop.invoiceNum ? ` · Inv ${stop.invoiceNum}` : ''}
                                      {' · '}{formatDate(stop.routeDate)}
                                    </p>
                                  </button>
                                ))}
                                {!row.isSearching && row.attachMode === 'customer' && row.customerResults.map((c) => (
                                  <button
                                    key={c.customerId}
                                    onMouseDown={() => handleSelectCustomer(row.id, c)}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0"
                                  >
                                    <p className="font-medium text-gray-800 text-sm">{c.customerName}</p>
                                    {c.groupCode && <p className="text-gray-500 text-xs">Group: {c.groupCode}</p>}
                                  </button>
                                ))}
                                {!row.isSearching && ((row.attachMode === 'stop' && row.searchResults.length === 0) || (row.attachMode === 'customer' && row.customerResults.length === 0)) && row.searchQuery.length >= 2 && (
                                  <div className="px-3 py-2 text-gray-400 text-sm">No results</div>
                                )}
                              </div>
                            )}
                          </div>

                          {row.assignedStop && (
                            <p className="text-green-600 text-xs">
                              Route {row.assignedStop.routeNumber} · Stop #{row.assignedStop.sequence} · {formatDate(row.assignedStop.routeDate)}
                            </p>
                          )}
                          {row.assignedCustomer && !row.assignedStop && (
                            <p className="text-green-600 text-xs">
                              Customer-level attachment (no stop link)
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Doc type */}
                    <td className="px-4 py-3">
                      {!row.excluded && (
                        <div className="space-y-1.5">
                          <select
                            value={row.docType}
                            onChange={(e) => handleDocTypeChange(row.id, e.target.value)}
                            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                          >
                            {DOC_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                          {row.attachMode === 'stop' && REF_NUMBER_TYPES.has(row.docType) && (
                            <div>
                              <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                                {row.docType === 'CREDIT_MEMO'
                                  ? 'Credit Memo #'
                                  : row.docType === 'PURCHASE_ORDER'
                                  ? 'PO #'
                                  : 'Invoice #'}
                              </label>
                              <input
                                type="text"
                                value={row.referenceNumber}
                                onChange={(e) => handleReferenceNumberChange(row.id, e.target.value)}
                                placeholder="Enter number"
                                className="w-32 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      {row.excluded ? (
                        <button
                          onClick={() => handleToggleExclude(row.id, false)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Include
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleExclude(row.id, true)}
                          className="text-xs text-gray-400 hover:text-red-500"
                        >
                          Exclude
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Commit button */}
          <div className="pt-2 flex justify-between items-center">
            <p className="text-xs text-gray-500">
              {resolvedRows.length > 0 && `${resolvedRows.length} ready to upload`}
              {resolvedRows.length > 0 && pendingRows.length > 0 && ' · '}
              {pendingRows.length > 0 && `${pendingRows.length} will stay for review`}
            </p>
            <button
              onClick={handleCommit}
              disabled={!canCommit || isCommitting}
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-8 rounded-lg transition-colors disabled:opacity-50"
            >
              {isCommitting
                ? 'Uploading…'
                : canCommit
                ? `Commit ${resolvedRows.length} Assigned Document(s)`
                : `Assign at least one file to continue`}
            </button>
          </div>
        </div>
      )}

      {/* ── History Panel ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow-sm border">
        <button
          onClick={toggleHistory}
          className="w-full flex justify-between items-center px-6 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Upload History</h2>
            <p className="text-xs text-gray-500 mt-0.5">Recent intake batches and per-file outcomes.</p>
          </div>
          <span className="text-gray-400 text-sm">{historyOpen ? 'Hide' : 'Show'}</span>
        </button>

        {historyOpen && (
          <div className="border-t border-gray-200 px-6 py-4 space-y-3">
            {historyLoading && <p className="text-sm text-gray-500">Loading…</p>}
            {!historyLoading && historyBatches.length === 0 && (
              <p className="text-sm text-gray-500">No batches yet.</p>
            )}
            {!historyLoading && historyBatches.map((batch) => {
              const isExpanded = expandedBatch === batch.id;
              const committed = batch.logs.filter((l) => l.status === 'MATCHED').length;
              const failedOrSkipped = batch.logs.filter((l) => l.status !== 'MATCHED').length;
              return (
                <div key={batch.id} className="border border-gray-200 rounded-lg">
                  <button
                    onClick={() => setExpandedBatch(isExpanded ? null : batch.id)}
                    className="w-full flex justify-between items-center px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {new Date(batch.createdAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {batch.user?.fullName || batch.user?.username || 'Unknown'} ·
                        {' '}{batch.totalFiles} file{batch.totalFiles === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex gap-3 text-xs shrink-0 ml-4">
                      <span className="text-green-700 font-medium">{committed} uploaded</span>
                      {failedOrSkipped > 0 && (
                        <span className="text-red-600 font-medium">{failedOrSkipped} skipped/failed</span>
                      )}
                      <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-200 divide-y divide-gray-100">
                      {batch.logs.length === 0 && (
                        <p className="px-4 py-2 text-xs text-gray-400">No files in this batch.</p>
                      )}
                      {batch.logs.map((log) => (
                        <div key={log.id} className="px-4 py-2 flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-800 truncate">{log.fileName}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {log.docType ? log.docType.replace('_', ' ').toLowerCase() : 'unknown'} ·
                              {' '}{log.flow === 'customer' ? 'customer-level' : log.flow === 'stop' ? 'stop-level' : '—'} ·
                              {' '}{formatSize(log.fileSize)}
                            </p>
                            {log.errorMessage && (
                              <p className="text-xs text-red-600 mt-0.5">{log.errorMessage}</p>
                            )}
                          </div>
                          <span
                            className={`text-xs font-medium shrink-0 px-2 py-0.5 rounded ${
                              log.status === 'MATCHED'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {log.status === 'MATCHED' ? 'uploaded' : 'failed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
