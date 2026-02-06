"use client";

import { useState } from "react";

interface CreateSheetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (spreadsheetId: string, title: string) => void;
    userId?: string;
    connectedAccountId?: string;
}

export default function CreateSheetModal({
    isOpen,
    onClose,
    onCreated,
    userId = "anonymous",
    connectedAccountId,
}: CreateSheetModalProps) {
    const [title, setTitle] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleCreate = async () => {
        if (!title.trim()) {
            setError("Please enter a spreadsheet name");
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
            const response = await fetch("/api/composio/create-sheet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    connectedAccountId,
                    userId,
                }),
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                setError(data.error || "Failed to create spreadsheet");
                return;
            }

            if (data.spreadsheetId) {
                onCreated(data.spreadsheetId, data.title);
                setTitle("");
                onClose();
            } else {
                setError("Spreadsheet created but no ID returned. Check Google Drive.");
            }
        } catch (err) {
            setError(`Network error: ${err}`);
        } finally {
            setIsCreating(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !isCreating) {
            handleCreate();
        }
        if (e.key === "Escape") {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
                <h2 className="text-xl font-semibold mb-4">Create New Spreadsheet</h2>

                <div className="space-y-4">
                    <div>
                        <label
                            htmlFor="sheet-title"
                            className="block text-sm font-medium text-gray-700 mb-1"
                        >
                            Spreadsheet Name
                        </label>
                        <input
                            id="sheet-title"
                            type="text"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                            placeholder="My New Spreadsheet"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isCreating}
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 justify-end">
                        <button
                            type="button"
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            onClick={onClose}
                            disabled={isCreating}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            onClick={handleCreate}
                            disabled={isCreating || !title.trim()}
                        >
                            {isCreating ? (
                                <>
                                    <svg
                                        className="animate-spin h-4 w-4"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    Creating...
                                </>
                            ) : (
                                "Create Spreadsheet"
                            )}
                        </button>
                    </div>
                </div>

                {/* Close button */}
                <button
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                    onClick={onClose}
                    aria-label="Close"
                >
                    <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
}
