# Quill

Long-form research writing agent. Harvests recent journals, writes consistent 20–150 page manuscripts, and exports PDF plus DOCX.

## What it does

- New chats for each manuscript
- Document type, citation style, and page-length dropdowns
- Live harvest from OpenAlex and Crossref (optional MCP server)
- Chapter-by-chapter writing with pipeline logs in chat
- PDF preview in the thread and DOCX/PDF download
- MongoDB persistence when `MONGODB_URI` is set; local JSON fallback otherwise

## Setup

```bash
# Install dependencies
npm install

# Copy environment template and add MongoDB / MCP values
cp .env.example .env.local
```

Required for production:

- `MONGODB_URI` — Atlas or any MongoDB connection string
- `MONGODB_DB` — database name, default `quill`
- `MCP_SERVER_URL` — optional Katabump MCP base URL. If present, `/research` is queried during harvest.

## Run

```bash
# Start the Next.js app
npm run dev
```

## Deploy on Vercel

Connect the repo, set `MONGODB_URI`, and deploy. Serverless function duration should be raised if you routinely generate 100+ page manuscripts.

## Writing pipeline

1. Intake brief
2. Journal harvest
3. Source ranking
4. Consistent outline
5. Chapter writing
6. Consistency pass
7. Citation assembly
8. Front matter
9. PDF / DOCX export
