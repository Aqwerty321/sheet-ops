# SheetOps 🚀

> AI-powered Google Sheets automation with natural language commands

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/sheet-ops)

## ✨ Features

### 🤖 AI-Powered Editing
- **Natural Language Commands**: "Remove duplicate emails", "Sort by amount descending", "Clean up phone numbers"
- **Streaming Responses**: Real-time agent feedback as it processes your request
- **Smart Operations**: Agent generates precise cell updates, row insertions, and deletions

### 🔗 Seamless Google Sheets Integration
- **Composio OAuth**: One-click Google account connection
- **Live Sync**: Pull data from any sheet, push changes back instantly
- **Multi-Tab Support**: Switch between worksheet tabs within a spreadsheet

### 📊 Visual Diff Preview
- **Before/After View**: See exactly what changes will be made
- **Validation Warnings**: Catch data type mismatches before applying
- **Selective Apply**: Review and approve changes before syncing

### 🛠️ Manual Tools
- **Remove Duplicates**: One-click duplicate detection and removal
- **Normalize Emails**: Standardize email formats across columns
- **Custom Operations**: Build your own data transformations

---

## 🏗️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | Next.js 14 App Router, React 18 |
| **Styling** | Tailwind CSS |
| **AI Agent** | Toolhouse.ai |
| **Google Integration** | Composio |
| **Deployment** | Vercel |

---

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/sheet-ops.git
cd sheet-ops
npm install
```

### 2. Configure Environment
```bash
cp .env.local.example .env.local
# Edit .env.local with your API keys
```

Required environment variables:
- `COMPOSIO_API_KEY` - From [Composio Dashboard](https://app.composio.dev)
- `TOOLHOUSE_API_KEY` - From [Toolhouse.ai](https://toolhouse.ai)
- `GOOGLE_SERVICE_ACCOUNT_KEY` - (Optional) For service account mode

### 3. Run Development Server
```bash
npm run dev
# Open http://localhost:3000
```

---

## 📁 Project Structure

```
sheet-ops/
├── app/
│   ├── api/
│   │   ├── chat/proxy/          # AI agent proxy with streaming
│   │   ├── composio/            # OAuth & Google Sheets operations
│   │   │   ├── connection/      # OAuth flow management
│   │   │   ├── sheets/          # List & read sheets
│   │   │   ├── sheet-tabs/      # Get worksheet tabs
│   │   │   └── push/            # Write changes to sheets
│   │   └── sheets/              # Service account operations
│   ├── components/
│   │   ├── AgentSidebar.tsx     # AI chat interface
│   │   ├── SheetPreview.tsx     # Editable data grid
│   │   ├── DiffViewer.tsx       # Change preview modal
│   │   └── ToolsPanel.tsx       # Manual operation tools
│   ├── hooks/
│   │   └── useAgentChat.ts      # Chat state management
│   ├── sheet/[sheetId]/         # Sheet editor page
│   └── page.tsx                 # Landing page
└── lib/
    └── sheets.ts                # Google Sheets API helpers
```

---

## 🎯 Key Capabilities Demo

### 1. Connect to Google Sheets
Click "Use my Google Sheets" → OAuth flow → Select any spreadsheet from your Drive

### 2. AI-Powered Edits
```
User: "Update all prices in column D to add 10%"
Agent: ✅ Generated 15 cell_update operations
       → Preview changes before applying
```

### 3. Push Changes
Review diff → Click "Push" → Changes sync to Google Sheets instantly

---

## 🔒 Authentication Modes

| Mode | Use Case |
|------|----------|
| **OAuth (Composio)** | User's own Google account, full Drive access |
| **Service Account** | Backend automation, shared team sheets |

---

## 📝 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/composio/connection` | GET/POST | Check/initiate OAuth |
| `/api/composio/sheets` | GET/POST | List sheets / Get data |
| `/api/composio/push` | POST | Write changes to sheet |
| `/api/chat/proxy` | POST/PUT | AI agent chat with streaming |

---

## 🚢 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy!

### Environment Variables in Vercel
```
COMPOSIO_API_KEY=your_key
TOOLHOUSE_API_KEY=your_key
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

---

## 📄 License

MIT © 2024

---

Built with ❤️ using [Next.js](https://nextjs.org), [Composio](https://composio.dev), and [Toolhouse](https://toolhouse.ai)
