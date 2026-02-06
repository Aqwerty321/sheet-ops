"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "./components/Card";
import Squares from "./components/Squares";
import TextType from "./components/TextType";
import GlareHover from "./components/GlareHover";
import CreateSheetModal from "./components/CreateSheetModal";

type AuthMode = "oauth" | "service";

export default function Page() {
    const router = useRouter();
    const [authMode, setAuthMode] = useState<AuthMode>("oauth");
    const [isModalOpen, setIsModalOpen] = useState(false);

    // OAuth state
    const [isConnected, setIsConnected] = useState(false);
    const [isCheckingConnection, setIsCheckingConnection] = useState(true);
    const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    // Service account state
    const [serviceSheets, setServiceSheets] = useState<Array<{ id: string; name: string }>>([]);
    const [loadingServiceSheets, setLoadingServiceSheets] = useState(false);
    const [serviceAccountEmail, setServiceAccountEmail] = useState<string | null>(null);
    const [isCreatingServiceSheet, setIsCreatingServiceSheet] = useState(false);
    const [newSheetTitle, setNewSheetTitle] = useState("");
    const [showServiceSheetPicker, setShowServiceSheetPicker] = useState(false);

    // Check OAuth connection on mount
    useEffect(() => {
        const checkConnection = async () => {
            try {
                const res = await fetch("/api/composio/connection?userId=anonymous");
                const data = await res.json();
                setIsConnected(data.connected ?? false);
                setConnectedAccountId(data.connectedAccountId ?? null);
            } catch {
                setIsConnected(false);
            } finally {
                setIsCheckingConnection(false);
            }
        };
        checkConnection();
    }, []);

    // Load service account sheets when mode changes
    useEffect(() => {
        if (authMode === "service") {
            loadServiceSheets();
        }
    }, [authMode]);

    const loadServiceSheets = async () => {
        setLoadingServiceSheets(true);
        try {
            const res = await fetch("/api/sheets/list");
            const data = await res.json();
            if (data.ok) {
                setServiceSheets(data.sheets || []);
                setServiceAccountEmail(data.serviceAccountEmail);
            }
        } catch (err) {
            console.error("Failed to load service sheets:", err);
        } finally {
            setLoadingServiceSheets(false);
        }
    };

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            const res = await fetch("/api/composio/connection", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: "anonymous",
                    app: "google_sheets",
                    redirectUrl: window.location.href,
                }),
            });
            const data = await res.json();
            if (data.redirectUrl) {
                window.location.href = data.redirectUrl;
            } else {
                alert("Failed to connect: " + (data.error || "Unknown error"));
            }
        } catch (err) {
            alert("Connection failed: " + err);
        } finally {
            setIsConnecting(false);
        }
    };

    const handleCreateClick = () => {
        if (authMode === "oauth") {
            if (!isConnected) {
                handleConnect();
            } else {
                setIsModalOpen(true);
            }
        } else {
            // Service account mode - show inline create UI
            setShowServiceSheetPicker(true);
        }
    };

    const handleSheetCreated = (spreadsheetId: string, title: string) => {
        // Save auth mode to localStorage before navigating
        localStorage.setItem("sheetops-authMode", authMode);
        router.push(`/sheet/${spreadsheetId}`);
    };

    const handleCreateServiceSheet = async () => {
        if (!newSheetTitle.trim()) return;

        setIsCreatingServiceSheet(true);
        try {
            const res = await fetch("/api/sheets/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newSheetTitle.trim() }),
            });
            const data = await res.json();
            if (data.ok && data.spreadsheetId) {
                localStorage.setItem("sheetops-authMode", "service");
                router.push(`/sheet/${data.spreadsheetId}`);
            } else {
                alert("Failed to create: " + (data.error || "Unknown error"));
            }
        } catch (err) {
            alert("Create failed: " + err);
        } finally {
            setIsCreatingServiceSheet(false);
        }
    };

    const handleSelectServiceSheet = (sheetId: string) => {
        localStorage.setItem("sheetops-authMode", "service");
        router.push(`/sheet/${sheetId}`);
    };

    return (
        <div className="min-h-screen bg-white text-black antialiased relative overflow-hidden">
            <div className="absolute inset-0">
                <div className="w-full h-full">
                    <Squares
                        speed={0.4}
                        squareSize={85}
                        direction="down"
                        borderColor="#4d4d4d"
                        hoverFillColor="#add8e6"
                    />
                </div>
            </div>
            <main className="max-w-6xl mx-auto px-4 py-12">
                <div className="min-h-[60vh] flex items-center justify-center relative z-10 translate-x-[85px]">
                    <div className="w-full max-w-xl">
                        <GlareHover
                            glareColor="#aeadad"
                            glareOpacity={0.3}
                            glareAngle={-30}
                            glareSize={300}
                            transitionDuration={1000}
                            playOnce
                            className="inline-block"
                            width="fit-content"
                            height="fit-content"
                            background="transparent"
                            borderRadius="12px"
                            style={{ padding: "0" }}
                        >
                            <Card className="border border-gray-300">
                                <header className="text-center mb-6">
                                    <TextType
                                        as="h1"
                                        className="text-4xl md:text-5xl font-semibold"
                                        text={["SheetOps"]}
                                        typingSpeed={70}
                                        pauseDuration={1200}
                                        deletingSpeed={40}
                                        loop={false}
                                        showCursor
                                        cursorCharacter="|"
                                        cursorBlinkDuration={1}
                                    />
                                    <p className="mt-2 text-gray-600">
                                        Automate your spreadsheet tasks
                                    </p>
                                </header>

                                {/* Auth Mode Toggle */}
                                <div className="flex justify-center gap-2 mb-4">
                                    <button
                                        onClick={() => setAuthMode("service")}
                                        className={`px-4 py-2 text-sm rounded-lg transition-colors ${authMode === "service"
                                                ? "bg-gray-900 text-white"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                            }`}
                                    >
                                        Use app sheets (no sign-in)
                                    </button>
                                    <button
                                        onClick={() => setAuthMode("oauth")}
                                        className={`px-4 py-2 text-sm rounded-lg transition-colors ${authMode === "oauth"
                                                ? "bg-gray-900 text-white"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                            }`}
                                    >
                                        Use my Google Sheets
                                    </button>
                                </div>

                                {/* OAuth Mode */}
                                {authMode === "oauth" && (
                                    <>
                                        {/* Connection Status */}
                                        <div className="mb-4 flex items-center justify-center gap-2 text-sm">
                                            {isCheckingConnection ? (
                                                <span className="text-gray-500">Checking connection...</span>
                                            ) : isConnected ? (
                                                <span className="text-green-600 flex items-center gap-1">
                                                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                                    Google account connected
                                                </span>
                                            ) : (
                                                <span className="text-gray-500 flex items-center gap-1">
                                                    <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                                                    Not connected
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-col md:flex-row gap-3 md:justify-center">
                                            <button
                                                onClick={handleCreateClick}
                                                disabled={isConnecting}
                                                className="w-full md:w-auto px-6 py-3 rounded-md border border-gray-300 bg-black text-white text-center hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {isConnecting ? (
                                                    <>
                                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                        </svg>
                                                        Connecting...
                                                    </>
                                                ) : isConnected ? (
                                                    "Create new spreadsheet"
                                                ) : (
                                                    "Connect & Create"
                                                )}
                                            </button>
                                            <a
                                                href="/sheet/sample"
                                                className="w-full md:w-auto px-6 py-3 rounded-md border border-gray-300 bg-white text-black text-center hover:bg-gray-50"
                                            >
                                                Open sample sheet
                                            </a>
                                        </div>
                                        <p className="mt-4 text-center text-sm text-gray-600">
                                            {isConnected
                                                ? "Create a new spreadsheet in your Google Drive"
                                                : "Connect your Google account to create spreadsheets"}
                                        </p>
                                    </>
                                )}

                                {/* Service Account Mode */}
                                {authMode === "service" && (
                                    <>
                                        {serviceAccountEmail && (
                                            <div className="mb-4 text-center text-xs text-gray-500">
                                                Service account: <code className="bg-gray-100 px-1 rounded">{serviceAccountEmail}</code>
                                            </div>
                                        )}

                                        {!showServiceSheetPicker ? (
                                            <div className="flex flex-col md:flex-row gap-3 md:justify-center">
                                                <button
                                                    onClick={handleCreateClick}
                                                    className="w-full md:w-auto px-6 py-3 rounded-md border border-gray-300 bg-black text-white text-center hover:opacity-95"
                                                >
                                                    Create or select sheet
                                                </button>
                                                <a
                                                    href="/sheet/sample"
                                                    className="w-full md:w-auto px-6 py-3 rounded-md border border-gray-300 bg-white text-black text-center hover:bg-gray-50"
                                                >
                                                    Open sample sheet
                                                </a>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {/* Create New Sheet */}
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <h3 className="text-sm font-medium mb-2">Create new spreadsheet</h3>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Spreadsheet name"
                                                            value={newSheetTitle}
                                                            onChange={(e) => setNewSheetTitle(e.target.value)}
                                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                                                            onKeyDown={(e) => e.key === "Enter" && handleCreateServiceSheet()}
                                                        />
                                                        <button
                                                            onClick={handleCreateServiceSheet}
                                                            disabled={isCreatingServiceSheet || !newSheetTitle.trim()}
                                                            className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
                                                        >
                                                            {isCreatingServiceSheet ? "Creating..." : "Create"}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Existing Sheets */}
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <h3 className="text-sm font-medium mb-2">
                                                        Or select an existing sheet
                                                        {loadingServiceSheets && <span className="text-gray-400 ml-2">(loading...)</span>}
                                                    </h3>
                                                    {serviceSheets.length > 0 ? (
                                                        <div className="max-h-40 overflow-y-auto space-y-1">
                                                            {serviceSheets.map((sheet) => (
                                                                <button
                                                                    key={sheet.id}
                                                                    onClick={() => handleSelectServiceSheet(sheet.id)}
                                                                    className="w-full text-left px-3 py-2 text-sm bg-white hover:bg-gray-100 rounded border border-gray-200 truncate"
                                                                >
                                                                    {sheet.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : !loadingServiceSheets ? (
                                                        <p className="text-sm text-gray-500">
                                                            No sheets found. Create one above or share a sheet with the service account.
                                                        </p>
                                                    ) : null}
                                                </div>

                                                <button
                                                    onClick={() => setShowServiceSheetPicker(false)}
                                                    className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
                                                >
                                                    ← Go back
                                                </button>
                                            </div>
                                        )}

                                        {!showServiceSheetPicker && (
                                            <p className="mt-4 text-center text-sm text-gray-600">
                                                Demo mode - no Google sign-in required
                                            </p>
                                        )}
                                    </>
                                )}
                            </Card>
                        </GlareHover>
                    </div>
                </div>
            </main>

            {/* Create Sheet Modal (for OAuth mode) */}
            <CreateSheetModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreated={handleSheetCreated}
                connectedAccountId={connectedAccountId ?? undefined}
            />
        </div>
    );
}
