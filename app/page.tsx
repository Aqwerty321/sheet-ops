"use client";

import Card from "./components/Card";
import Squares from "./components/Squares";
import TextType from "./components/TextType";
import GlareHover from "./components/GlareHover";

export default function Page() {
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
                                <div className="flex flex-col md:flex-row gap-3 md:justify-center">
                                    <a
                                        href="/sheet/new"
                                        aria-label="Create new empty sheet"
                                        className="w-full md:w-auto px-6 py-3 rounded-md border border-gray-300 bg-black text-white text-center hover:opacity-95"
                                    >
                                        Create new empty sheet
                                    </a>
                                    <a
                                        href="/sheet/sample"
                                        aria-label="Open sample sheet"
                                        className="w-full md:w-auto px-6 py-3 rounded-md border border-gray-300 bg-white text-black text-center"
                                    >
                                        Open sample sheet
                                    </a>
                                </div>
                                <p className="mt-4 text-center text-sm text-gray-600">
                                    No sign-in required. Try a sample or start fresh.
                                </p>
                            </Card>
                        </GlareHover>
                    </div>
                </div>
            </main>
        </div>
    );
}
