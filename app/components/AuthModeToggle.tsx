"use client";

interface AuthModeToggleProps {
  mode: "service" | "oauth";
  onChange: (mode: "service" | "oauth") => void;
  connecting: boolean;
  connected: boolean;
  onConnect: () => void;
  error?: string | null;
}

export default function AuthModeToggle({
  mode,
  onChange,
  connecting,
  connected,
  onConnect,
  error,
}: AuthModeToggleProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <div className="inline-flex rounded-md border border-gray-300 p-1">
        <button
          aria-label="Use app sheets"
          className={`px-3 py-1 rounded ${
            mode === "service" ? "bg-black text-white" : "text-black"
          }`}
          onClick={() => onChange("service")}
        >
          Use app sheets (no sign-in)
        </button>
        <button
          aria-label="Use my Google Sheets"
          className={`px-3 py-1 rounded ${
            mode === "oauth" ? "bg-black text-white" : "text-black"
          }`}
          onClick={() => onChange("oauth")}
        >
          Use my Google Sheets
        </button>
      </div>
      {mode === "oauth" && (
        <div className="flex items-center gap-2">
          <button
            aria-label="Connect Google Sheets"
            className="rounded-md border border-gray-300 px-3 py-1.5"
            onClick={onConnect}
            disabled={connecting}
          >
            {connected ? "Connected" : connecting ? "Connecting..." : "Connect"}
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}
    </div>
  );
}