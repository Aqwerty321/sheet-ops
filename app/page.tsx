"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "./components/Card";
import Squares from "./components/Squares";
import TextType from "./components/TextType";
import GlareHover from "./components/GlareHover";
import CreateSheetModal from "./components/CreateSheetModal";

export default function Page() {
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isCheckingConnection, setIsCheckingConnection] = useState(true);
    const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    // Check if user has connected Google account
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
        if (!isConnected) {
            handleConnect();
        } else {
            setIsModalOpen(true);
        }
    };

    const handleSheetCreated = (spreadsheetId: string, title: string) => {
        // Navigate to the new sheet
        router.push(`/sheet/${spreadsheetId}`);
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
                                        aria-label={isConnected ? "Create new spreadsheet" : "Connect Google account"}
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
                                        aria-label="Open sample sheet"
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
                            </Card>
                        </GlareHover>
                    </div>
                </div>
            </main>

            {/* Create Sheet Modal */}
            <CreateSheetModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreated={handleSheetCreated}
                connectedAccountId={connectedAccountId ?? undefined}
            />
        </div>
    );
}
