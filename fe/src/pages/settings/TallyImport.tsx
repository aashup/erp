import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/usePageTitle";
import { tallyImportApi } from "@/api/tallyImport";
import type {
  TallyLedgerPreview,
  TallyStockItemPreview,
  TallyGroupPreview,
  ImportResult,
  ImportError,
} from "@/api/tallyImport";
import { companySettingsApi } from "@/api/settings";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Upload,
  Wifi,
  Database,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  AlertTriangle,
  FolderOpen,
  Folder,
} from "lucide-react";
import type { TallyConnectionMethod } from "@/api/tallyImport";
import toast from "react-hot-toast";
import { todayLocalDate } from "@/lib/utils";

// ─── Shared sub-components ───────────────────────────────────────────────────

function ImportResultCard({ result }: { result: ImportResult }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap gap-6 text-sm font-medium">
        <span className="text-green-600 dark:text-green-400">
          ✓ Created: {result.created}
        </span>
        <span className="text-gray-500">— Skipped: {result.skipped}</span>
        {result.failed > 0 && (
          <span className="text-red-600 dark:text-red-400">
            ✗ Failed: {result.failed}
          </span>
        )}
      </div>
      {result.errors.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-sm text-red-600 hover:underline dark:text-red-400"
          >
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {result.errors.length} error{result.errors.length > 1 ? "s" : ""} — click to{" "}
            {open ? "collapse" : "expand"}
          </button>
          {open && (
            <ul className="mt-2 max-h-48 overflow-y-auto space-y-1 rounded border border-red-100 bg-red-50 p-2 dark:border-red-900 dark:bg-red-950">
              {result.errors.map((e: ImportError, i: number) => (
                <li key={i} className="text-xs text-red-700 dark:text-red-300">
                  <span className="font-medium">[{e.entity}]</span> {e.name}:{" "}
                  {e.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

type ImportMode = "xml" | "odbc" | "file";

function ModeToggle({
  mode,
  onChange,
}: {
  mode: ImportMode;
  onChange: (m: ImportMode) => void;
}) {
  const options: { value: ImportMode; icon: React.ReactNode; label: string }[] = [
    { value: "xml",  icon: <Wifi className="h-4 w-4" />,     label: "XML over HTTP" },
    { value: "odbc", icon: <Database className="h-4 w-4" />, label: "ODBC Direct" },
    { value: "file", icon: <Upload className="h-4 w-4" />,   label: "Upload File" },
  ];
  return (
    <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden w-fit">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            i > 0 ? "border-l border-gray-200 dark:border-gray-700" : ""
          } ${
            mode === opt.value
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function XmlFileInput({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3">
      <input
        ref={ref}
        type="file"
        accept=".xml,text/xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          onChange(f);
          e.target.value = "";
        }}
      />
      <Button
        variant="secondary"
        size="sm"
        onClick={() => ref.current?.click()}
      >
        <Upload className="h-4 w-4 mr-1" />
        Choose XML File
      </Button>
      {file ? (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {file.name}
        </span>
      ) : (
        <span className="text-sm text-gray-400">No file selected</span>
      )}
    </div>
  );
}

// ─── Section 1: Connection ────────────────────────────────────────────────────

function ConnectionTestRow({
  label,
  icon,
  testMutation,
  url,
}: {
  label: string;
  icon: React.ReactNode;
  testMutation: ReturnType<typeof useMutation<{ data: import("@/api/tallyImport").TallyConnectionResult }>>;
  url: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 w-40 shrink-0">
          {icon}
          {label}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending || !url}
        >
          {testMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : null}
          {testMutation.isPending ? "Testing…" : "Test Connection"}
        </Button>
        {testMutation.data && (
          <span
            className={`flex items-center gap-1 text-sm ${
              testMutation.data.data.connected
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {testMutation.data.data.connected ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {testMutation.data.data.message}
          </span>
        )}
        {testMutation.isError && (
          <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
            <XCircle className="h-4 w-4" />
            Connection failed
          </span>
        )}
      </div>
    </div>
  );
}

function ConnectionSection() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: () => companySettingsApi.get(),
    select: (res) => res.data.data,
  });

  useEffect(() => {
    const raw = settings as Record<string, unknown>;
    if (typeof raw?.tally_server_url === "string" && raw.tally_server_url) {
      setUrl(raw.tally_server_url);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => companySettingsApi.update({ tally_server_url: url }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("Tally URL saved");
    },
    onError: () => toast.error("Failed to save URL"),
  });

  const xmlTestMutation = useMutation({
    mutationFn: tallyImportApi.testConnection,
  });

  const odbcTestMutation = useMutation({
    mutationFn: tallyImportApi.testOdbcConnection,
  });

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Tally Connection Settings
        </h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Both methods use the same Tally host and port. Test each independently.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Shared URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tally Server URL
          </label>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex-1 max-w-sm">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:9000"
              />
            </div>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !url}
              size="sm"
            >
              {saveMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              Save URL
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            Same URL for both methods — Tally uses port 9000 for both XML HTTP and ODBC.
            On the same PC use{" "}
            <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">http://localhost:9000</code>.
          </p>
        </div>

        {/* Method 1: XML over HTTP */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Wifi className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Method 1 — XML over HTTP
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Sends XML envelopes to Tally's built-in HTTP server and parses the XML response.
              Works over LAN and localhost. No extra driver installation needed.
            </p>
          </div>
          <ConnectionTestRow
            label="XML over HTTP"
            icon={<Wifi className="h-4 w-4 text-blue-500" />}
            testMutation={xmlTestMutation as any}
            url={url}
          />
        </div>

        {/* Method 2: ODBC Direct Query */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Method 2 — ODBC Direct Query (Database Bridge)
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Connects to Tally as a database via ODBC and runs SQL-like SELECT queries directly.
              Uses the same import functions — only the data source changes.
            </p>
          </div>
          <div className="rounded bg-blue-50 border border-blue-200 px-3 py-2 dark:bg-blue-950 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
            <p className="font-medium">Requirements</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Tally ODBC Driver must be installed on the PHP server machine.</li>
              <li>Windows: driver is bundled with Tally. Linux: install <code>unixodbc</code> + configure DSN.</li>
              <li>PHP <code>php-odbc</code> extension must be enabled.</li>
            </ul>
          </div>
          <ConnectionTestRow
            label="ODBC"
            icon={<Database className="h-4 w-4 text-purple-500" />}
            testMutation={odbcTestMutation as any}
            url={url}
          />
        </div>

      </CardContent>
    </Card>
  );
}

// ─── Section 2: Ledgers / Parties ────────────────────────────────────────────

function LedgersTab() {
  const [mode, setMode] = useState<ImportMode>("xml");
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<TallyLedgerPreview[] | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const fetchMutation = useMutation({
    mutationFn: tallyImportApi.fetchLedgers,
    onSuccess: (res) => {
      setPreview(res.data.data);
      setImportResult(null);
    },
    onError: () => toast.error("Failed to fetch ledgers from Tally"),
  });

  const importMutation = useMutation({
    mutationFn: tallyImportApi.importLedgers,
    onSuccess: (res) => setImportResult(res.data),
    onError: () => toast.error("Import failed"),
  });

  const isLive = mode === "xml" || mode === "odbc";

  const handleFetch = () => {
    fetchMutation.mutate(mode as "xml" | "odbc");
  };

  const handleImport = async () => {
    if (mode === "file") {
      if (!xmlFile) { toast.error("Please select an XML file"); return; }
      const text = await xmlFile.text();
      importMutation.mutate({ mode: "file", xml_content: text });
    } else {
      importMutation.mutate({ mode: "live", connection_method: mode as "xml" | "odbc" });
    }
  };

  const partyCount = preview?.filter((l) => l.party_type !== null).length ?? 0;
  const ledgerCount = preview?.filter((l) => l.party_type === null).length ?? 0;

  return (
    <div className="space-y-4">
      <ModeToggle mode={mode} onChange={(m) => { setMode(m); setPreview(null); setImportResult(null); }} />

      {mode === "file" && (
        <XmlFileInput file={xmlFile} onChange={setXmlFile} />
      )}

      {mode === "odbc" && (
        <p className="text-xs text-purple-600 dark:text-purple-400">
          Queries <code>SELECT Name, Parent, OpeningBalance, GSTRegistrationNumber, LedMobile, Email FROM Ledger</code>
        </p>
      )}

      <div className="flex gap-3">
        {isLive && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleFetch}
            disabled={fetchMutation.isPending}
          >
            {fetchMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : null}
            {fetchMutation.isPending
              ? (mode === "odbc" ? "Querying via ODBC…" : "Fetching via XML…")
              : "Fetch Preview"}
          </Button>
        )}

        <Button
          size="sm"
          onClick={handleImport}
          disabled={importMutation.isPending}
        >
          {importMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : null}
          {importMutation.isPending
            ? "Importing… please wait"
            : preview !== null
            ? `Import ${preview.length} Records`
            : "Import"}
        </Button>
      </div>

      {fetchMutation.isError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Failed to fetch from Tally. Check connection settings.
        </p>
      )}

      {preview !== null && (
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Found <strong>{preview.length}</strong> ledgers —{" "}
            <strong>{partyCount}</strong> parties (customers/vendors),{" "}
            <strong>{ledgerCount}</strong> accounting ledgers
            {preview.length > 100 && " (showing first 100)"}
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Parent Group</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">GSTIN</th>
                  <th className="px-4 py-3 text-right">Opening Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {preview.slice(0, 100).map((l, i) => (
                  <tr
                    key={i}
                    className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                      {l.name}
                    </td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                      {l.parent}
                    </td>
                    <td className="px-4 py-2">
                      {l.party_type === "customer" ? (
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          Customer
                        </span>
                      ) : l.party_type === "vendor" ? (
                        <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                          Vendor
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          Ledger
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400 font-mono text-xs">
                      {l.gstin ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                      {l.opening_balance > 0
                        ? `₹${l.opening_balance.toLocaleString("en-IN")} ${l.balance_type.toUpperCase()}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {importResult && <ImportResultCard result={importResult} />}
    </div>
  );
}

// ─── Section 2b: Stock Items ─────────────────────────────────────────────────

function StockItemsTab() {
  const [mode, setMode] = useState<ImportMode>("xml");
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<TallyStockItemPreview[] | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const fetchMutation = useMutation({
    mutationFn: tallyImportApi.fetchStockItems,
    onSuccess: (res) => {
      setPreview(res.data.data);
      setImportResult(null);
    },
    onError: () => toast.error("Failed to fetch stock items from Tally"),
  });

  const importMutation = useMutation({
    mutationFn: tallyImportApi.importStockItems,
    onSuccess: (res) => setImportResult(res.data),
    onError: () => toast.error("Import failed"),
  });

  const isLive = mode === "xml" || mode === "odbc";

  const handleImport = async () => {
    if (mode === "file") {
      if (!xmlFile) { toast.error("Please select an XML file"); return; }
      const text = await xmlFile.text();
      importMutation.mutate({ mode: "file", xml_content: text });
    } else {
      importMutation.mutate({ mode: "live", connection_method: mode as "xml" | "odbc" });
    }
  };

  return (
    <div className="space-y-4">
      <ModeToggle mode={mode} onChange={(m) => { setMode(m); setPreview(null); setImportResult(null); }} />

      {mode === "file" && (
        <XmlFileInput file={xmlFile} onChange={setXmlFile} />
      )}

      {mode === "odbc" && (
        <p className="text-xs text-purple-600 dark:text-purple-400">
          Queries <code>SELECT Name, Parent, BaseUnits, HSNCode, GSTRate FROM StockItem</code>
        </p>
      )}

      <div className="flex gap-3">
        {isLive && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchMutation.mutate(mode as "xml" | "odbc")}
            disabled={fetchMutation.isPending}
          >
            {fetchMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : null}
            {fetchMutation.isPending
              ? (mode === "odbc" ? "Querying via ODBC…" : "Fetching via XML…")
              : "Fetch Preview"}
          </Button>
        )}

        <Button
          size="sm"
          onClick={handleImport}
          disabled={importMutation.isPending}
        >
          {importMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : null}
          {importMutation.isPending
            ? "Importing… please wait"
            : preview !== null
            ? `Import ${preview.length} Items`
            : "Import"}
        </Button>
      </div>

      {fetchMutation.isError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Failed to fetch from Tally. Check connection settings.
        </p>
      )}

      {preview !== null && (
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Found <strong>{preview.length}</strong> stock items
            {preview.length > 100 && " (showing first 100)"}
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Group</th>
                  <th className="px-4 py-3 text-left">Unit</th>
                  <th className="px-4 py-3 text-left">HSN Code</th>
                  <th className="px-4 py-3 text-right">GST %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {preview.slice(0, 100).map((item, i) => (
                  <tr
                    key={i}
                    className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                      {item.name}
                    </td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                      {item.parent}
                    </td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300 font-mono text-xs">
                      {item.unit}
                    </td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400 font-mono text-xs">
                      {item.hsn_code ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                      {item.igst > 0 ? `${item.igst}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {importResult && <ImportResultCard result={importResult} />}
    </div>
  );
}

// ─── Section 2c: Groups ──────────────────────────────────────────────────────

function GroupTreeNode({
  group,
  depth = 0,
}: {
  group: TallyGroupPreview;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = group.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-default"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {hasChildren ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        )}
        <span className="ml-1 text-sm text-gray-800 dark:text-gray-200">
          {group.name}
        </span>
        {group.parent && depth === 0 && (
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
            under {group.parent}
          </span>
        )}
        {hasChildren && (
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
            ({group.children.length})
          </span>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {group.children.map((child, i) => (
            <GroupTreeNode key={i} group={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupsTab() {
  const [groups, setGroups] = useState<TallyGroupPreview[] | null>(null);

  const fetchMutation = useMutation({
    mutationFn: tallyImportApi.fetchGroups,
    onSuccess: (res) => setGroups(res.data.data),
    onError: () => toast.error("Failed to fetch groups from Tally"),
  });

  const totalCount = (nodes: TallyGroupPreview[]): number =>
    nodes.reduce((n, g) => n + 1 + totalCount(g.children), 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Fetches all accounting groups and sub-groups from Tally via XML. Read-only preview — groups are not imported (use{" "}
        <strong>Load Default Account Groups</strong> in Company Settings instead).
      </p>

      <Button
        variant="secondary"
        size="sm"
        onClick={() => fetchMutation.mutate()}
        disabled={fetchMutation.isPending}
      >
        {fetchMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : null}
        {fetchMutation.isPending ? "Fetching groups…" : "Fetch Groups from Tally"}
      </Button>

      {fetchMutation.isError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Failed to fetch groups. Check connection settings.
        </p>
      )}

      {groups !== null && (
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Found <strong>{totalCount(groups)}</strong> groups (
            <strong>{groups.length}</strong> root groups)
          </p>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 max-h-96 overflow-y-auto p-2">
            {groups.map((g, i) => (
              <GroupTreeNode key={i} group={g} depth={0} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section 3: Vouchers ─────────────────────────────────────────────────────

function VouchersSection() {
  const today = todayLocalDate();
  const fyStart =
    new Date().getMonth() >= 3
      ? `${new Date().getFullYear()}-04-01`
      : `${new Date().getFullYear() - 1}-04-01`;

  const [mode, setMode] = useState<ImportMode>("xml");
  const [dateFrom, setDateFrom] = useState(fyStart);
  const [dateTo, setDateTo] = useState(today);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const isLive = mode === "xml" || mode === "odbc";

  const importMutation = useMutation({
    mutationFn: tallyImportApi.importVouchers,
    onSuccess: (res) => setImportResult(res.data),
    onError: () => toast.error("Voucher import failed"),
  });

  const handleImport = async () => {
    if (mode === "file") {
      if (!xmlFile) { toast.error("Please select an XML file"); return; }
      const text = await xmlFile.text();
      importMutation.mutate({ mode: "file", xml_content: text });
    } else {
      if (!dateFrom || !dateTo) { toast.error("Please select a date range"); return; }
      importMutation.mutate({ mode: "live", date_from: dateFrom, date_to: dateTo, connection_method: mode as "xml" | "odbc" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Import Transactions (Vouchers)
        </h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Imports all vouchers from Tally's Day Book as double-entry accounting vouchers.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950">
          <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Voucher import requires all referenced ledgers to already exist. Import{" "}
            <strong>Masters first</strong> (Ledgers & Parties, then Stock Items).
          </p>
        </div>

        <ModeToggle mode={mode} onChange={(m) => { setMode(m); setImportResult(null); }} />

        {mode === "odbc" && (
          <p className="text-xs text-purple-600 dark:text-purple-400">
            Queries <code>SELECT Date, VoucherType, VoucherNumber, Narration, LedgerName, Amount FROM DayBook WHERE Date &gt;= … AND Date &lt;= …</code>
          </p>
        )}

        {isLive && (
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
        )}

        {mode === "file" && (
          <XmlFileInput file={xmlFile} onChange={setXmlFile} />
        )}

        <Button
          size="sm"
          onClick={handleImport}
          disabled={importMutation.isPending}
        >
          {importMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : null}
          {importMutation.isPending
            ? (mode === "odbc" ? "Querying via ODBC… please wait" : "Importing vouchers… please wait")
            : "Import Vouchers"}
        </Button>

        {importResult && <ImportResultCard result={importResult} />}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type MasterTab = "ledgers" | "stock-items" | "groups";

export default function TallyImport() {
  usePageTitle("Tally Import");
  const [masterTab, setMasterTab] = useState<MasterTab>("ledgers");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Tally Import
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Import masters and transactions from Tally ERP via XML over HTTP.
        </p>
      </div>

      {/* Recommended sequence note */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Recommended sequence:</strong> (1) Load Default Account Groups in Company Settings
          → (2) Import Ledgers &amp; Parties → (3) Import Stock Items → (4) Import Vouchers
        </p>
      </div>

      {/* Section 1: Connection */}
      <ConnectionSection />

      {/* Section 2: Masters */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Import Masters
          </h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Import ledgers, parties, and stock items from Tally.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {(["ledgers", "stock-items", "groups"] as MasterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setMasterTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  masterTab === tab
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {tab === "ledgers" ? "Ledgers & Parties" : tab === "stock-items" ? "Stock Items" : "Account Groups"}
              </button>
            ))}
          </div>

          {masterTab === "ledgers" ? (
            <LedgersTab />
          ) : masterTab === "stock-items" ? (
            <StockItemsTab />
          ) : (
            <GroupsTab />
          )}
        </CardContent>
      </Card>

      {/* Section 3: Vouchers */}
      <VouchersSection />
    </div>
  );
}
