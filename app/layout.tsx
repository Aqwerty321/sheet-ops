import type { Metadata } from "next";
import "./globals.css";
import GlobalClickSpark from "./components/GlobalClickSpark";

export const metadata: Metadata = {
    title: "SheetOps - Automate Your Spreadsheet Tasks",
    description: "AI-powered spreadsheet automation with Google Sheets integration",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>
                <GlobalClickSpark>{children}</GlobalClickSpark>
            </body>
        </html>
    );
}
