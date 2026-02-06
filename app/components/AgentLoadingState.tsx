import React from "react";

interface AgentLoadingStateProps {
  sheetName: string;
}

export default function AgentLoadingState({ sheetName }: AgentLoadingStateProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-lg font-semibold">Agent</div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
          Connecting...
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center space-y-4 px-4">
        <div className="text-center space-y-2">
          <h3 className="font-semibold text-gray-800">Connecting to Sheet</h3>
          <p className="text-sm text-gray-600">{sheetName}</p>
        </div>

        <div className="flex justify-center items-center space-x-1">
          <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
          <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
          <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
        </div>

        <p className="text-xs text-gray-500 text-center max-w-xs">
          Sending spreadsheet context to the agent and waiting for confirmation...
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-100 bg-white p-2">
        <div className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-500 text-center">
          Please wait...
        </div>
      </div>
    </div>
  );
}
