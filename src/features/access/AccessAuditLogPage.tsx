import { useCallback, useEffect, useState } from "react";
import { fetchAccessAuditLog, type AccessAuditLogEntry } from "../../api/accessAuditLog";
import { Select } from "../../components/controls";

const EVENT_OPTIONS = ["All Events", "USER_CREATED", "PROMOTION", "TRANSFER", "PERMISSION_CHANGE", "POLICY_PUBLISH", "TEMP_EXCEPTION_GRANTED", "TEMP_EXCEPTION_REVOKED"];

const EVENT_PILL: Record<string, string> = {
  USER_CREATED: "bg-gray-100 text-gray-600",
  PROMOTION: "bg-blue-50 text-blue-700",
  TRANSFER: "bg-green-50 text-green-700",
  PERMISSION_CHANGE: "bg-amber-50 text-amber-700",
  POLICY_PUBLISH: "bg-teal-50 text-teal",
  TEMP_EXCEPTION_GRANTED: "bg-amber-50 text-amber-700",
  TEMP_EXCEPTION_REVOKED: "bg-gray-100 text-gray-600",
};

export function AccessAuditLogPage() {
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("All Events");
  const [entries, setEntries] = useState<AccessAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchAccessAuditLog({ search: search || undefined, eventType })
      .then((res) => setEntries(res.entries))
      .finally(() => setLoading(false));
  }, [search, eventType]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">Access Audit Log</h1>
        <p className="mt-0.5 text-sm text-muted">Every promotion, transfer, access change, exception, and policy update - traceable to who and why.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-white p-4">
        <input
          type="text"
          placeholder="Search user or permission"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal"
        />
        <Select fitContent value={eventType} onChange={(e) => setEventType(e.target.value)}>
          {EVENT_OPTIONS.map((e) => (
            <option key={e} value={e}>
              {e.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold text-muted">
                <th className="px-4 py-3">Date / Time</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Change</th>
                <th className="px-4 py-3">Changed By</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted">
                    No matching events.
                  </td>
                </tr>
              )}
              {!loading &&
                entries.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-muted">
                      {new Date(e.createdAt).toLocaleString(undefined, { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-ink">{e.subject}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${EVENT_PILL[e.eventType] ?? "bg-gray-100 text-gray-600"}`}>
                        {e.eventType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{e.description}</td>
                    <td className="px-4 py-3 text-muted">{e.changedBy}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
