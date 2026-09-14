import { useState } from "react";
import { uploadCreditReport } from "../../api/creditProfile";
import { ApiError } from "../../api/client";
import { IconUpload, IconX } from "../layout/icons";

interface UploadCreditReportModalProps {
  leadId: string;
  onClose: () => void;
  onUploaded: () => void;
}

// Additional Info tab's manual upload path (see AdditionalInfoTab) - lets
// staff attach a report themselves (phone-collected, a corrected re-upload,
// or simply because the customer never reached the wizard's own upload
// step) instead of the tab only ever being populated by the customer-facing
// flow.
export function UploadCreditReportModal({ leadId, onClose, onUploaded }: UploadCreditReportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await uploadCreditReport(leadId, file);
      onUploaded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload credit report");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-card bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Upload Credit Report</h2>
          <button onClick={onClose} disabled={uploading} className="rounded p-1 text-muted hover:bg-bg disabled:opacity-50" aria-label="Close">
            <IconX width={18} height={18} />
          </button>
        </div>

        <p className="mb-3 text-xs text-muted">
          DebtConquest will read this report with AI and build the profile shown on this tab from it - a new upload always creates a fresh, separate
          snapshot rather than overwriting an existing one. This can take a minute or two on a long report.
        </p>

        <label
          className={`mb-3 flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-8 text-center ${
            uploading ? "cursor-not-allowed border-border opacity-60" : "cursor-pointer border-border hover:border-teal"
          }`}
        >
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.csv,.xlsx,.xls"
            className="hidden"
            disabled={uploading}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <IconUpload width={20} height={20} className="text-muted" />
          <span className="text-sm font-medium text-ink">{file ? file.name : "Click to choose a file"}</span>
          <span className="text-[10px] text-muted">PDF, image, or spreadsheet export - up to 20MB</span>
        </label>

        {error && <p className="mb-3 text-sm text-error">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-bg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60"
          >
            {uploading ? "Analyzing…" : "Upload & Analyze"}
          </button>
        </div>
      </div>
    </div>
  );
}
