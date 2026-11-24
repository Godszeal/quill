# Quill MCP Research Server

Deploy this MCP server on your Katabump server. It provides a Model Context Protocol endpoint at `/mcp` that works with **Claude** and **Quill** for harvesting recent academic journals.

## Deploy on Katabump

1. Upload this folder to your Katabump server
2. Install dependencies:

```bash
npm install
```

3. Copy `.env.example` to `.env` (tunnel credentials are pre-filled):

```bash
cp .env.example .env
```

4. Start the server:

```bash
npm start
```

## Connect a Custom Domain via Cloudflare Tunnel

Tunnel credentials (`CLOUDFLARE_TUNNEL_ID`, `CLOUDFLARE_TUNNEL_TOKEN`) are pre-baked into `config.js` so you can deploy directly without manual setup. The server auto-starts `cloudflared tunnel --no-autoupdate run --url <CLOUDFLARE_SERVICE_URL>` and reconnects automatically if the connector stops.

Public domain: `https://mcp.myng.net`
Origin service: `http://127.0.0.1:20150`

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 20150 | Server listen port |
| PUBLIC_BASE_URL | `https://mcp.myng.net` | Public domain for the MCP server |
| CLOUDFLARE_TUNNEL_ID | (baked in) | Cloudflare tunnel UUID |
| CLOUDFLARE_TUNNEL_TOKEN | (baked in) | Rotated tunnel token from Zero Trust |
| CLOUDFLARE_SERVICE_URL | `http://127.0.0.1:20150` | Origin service URL for the tunnel |
| OAUTH_CLIENT_ID | `quill-mcp-client` | OAuth client ID for Claude connector |
| OAUTH_CLIENT_SECRET | `quill-mcp-secret-change-me` | OAuth client secret (change in production) |
| OAUTH_REDIRECT_URI | `https://mcp.myng.net/oauth/callback` | OAuth redirect callback URL |
| OAUTH_SCOPES | `mcp:read mcp:write` | OAuth scopes |
| CDN_USER_AGENT | `Quill-MCP/1.0` | User-Agent for outbound requests |
| REFERER_DOMAIN | `https://mcp.myng.net/` | Referer header domain |
| PROXY_CLIENT_IP | (none) | Optional detected proxy client IP |

Expected logs:

```text
Quill MCP server listening on 0.0.0.0:20150
[cloudflare] Starting token connector for acc4a5dc-817f-479f-a18b-7543214f357e; origin=http://127.0.0.1:20150
[cloudflare] Connected to tunnel acc4a5dc-817f-479f-a18b-7543214f357e for https://mcp.myng.net

╔═══════════════════════════════════════════════════════════╗
║        CLOUDFLARE TUNNEL IS CONNECTED                   ║
╠═══════════════════════════════════════════════════════════╣
║  Domain: https://mcp.myng.net                           ║
║  Tunnel: acc4a5dc-817f-479f-a18b-7543214f357e           ║
╚═══════════════════════════════════════════════════════════╝
```

4. Start the server:

```bash
npm start
```

## Connect a Custom Domain via Cloudflare Tunnel

This server follows the same Cloudflare tunnel pattern as [Godszeal/Movieboxapi-proxy](https://github.com/Godszeal/Movieboxapi-proxy). It uses the `cloudflared` package to run a token-authenticated tunnel connector that connects your local MCP server to a public Cloudflare domain.

### Prerequisites

1. Create a tunnel in [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) under Networks → Tunnels
2. Save the tunnel ID and rotated token
3. Add a public hostname (e.g. `mcp.quill.app`) pointing to service URL `http://127.0.0.1:20150`

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 20150 | Server listen port |
| PUBLIC_BASE_URL | `https://mcp.quill.app` | Public domain for the MCP server |
| CLOUDFLARE_TUNNEL_ID | (none) | Cloudflare tunnel UUID |
| CLOUDFLARE_TUNNEL_TOKEN | (none) | Rotated tunnel token from Zero Trust |
| CLOUDFLARE_SERVICE_URL | `http://127.0.0.1:20150` | Origin service URL for the tunnel |
| CDN_USER_AGENT | `Quill-MCP/1.0` | User-Agent for outbound requests |
| REFERER_DOMAIN | `https://quill.app/` | Referer header domain |
| PROXY_CLIENT_IP | (none) | Optional detected proxy client IP |

When `CLOUDFLARE_TUNNEL_TOKEN` is set, the server auto-starts `cloudflared tunnel --no-autoupdate run --url <CLOUDFLARE_SERVICE_URL>` and reconnects automatically if the connector stops.

Expected logs:

```text
Quill MCP server listening on 0.0.0.0:20150
[cloudflare] Starting token connector for <tunnel-id>; origin=http://127.0.0.1:20150
[cloudflare] Connected to tunnel <tunnel-id> for https://mcp.quill.app

╔═══════════════════════════════════════════════════════════╗
║        CLOUDFLARE TUNNEL IS CONNECTED                   ║
╠═══════════════════════════════════════════════════════════╣
║  Domain: https://mcp.quill.app                          ║
║  Tunnel: <tunnel-id>                                    ║
╚══════════════════════════════════════════════════════════╝
```

## Connect Claude (MCP Integration)

Add this MCP server to your Claude client (Claude Desktop, Claude Code, or any MCP-compatible client):

**HTTP Streamable Transport:**

```
https://your-domain.com/mcp
```

**Claude Desktop config (`claude_desktop_config.json`):**

```json
{
  "mcpServers": {
    "quill-research": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/remote-mcp-client", "https://your-domain.com/mcp"]
    }
  }
}
```

Once connected, Claude can call the `research` tool:

```
"Research recent papers on climate-smart agriculture in West Africa"
```

Claude will automatically:
1. List available tools via `tools/list`
2. Call `tools/call` with name `research` and your topic
3. Receive formatted paper results with title, authors, year, venue, citations, DOI, URL, PDF, and abstract

## Claude OAuth Connection

If Claude prompts for OAuth sign-in, the server supports the standard OAuth 2.0 Authorization Code flow:

### OAuth Metadata

```
GET https://mcp.myng.net/.well-known/oauth-authorization-server
```

Returns the OAuth authorization server metadata (issuer, endpoints, scopes).

### OAuth Flow

1. **Authorize**: Claude redirects the user to:
   ```
   GET https://mcp.myng.net/oauth/authorize?response_type=code&client_id=quill-mcp-client&redirect_uri=https://mcp.myng.net/oauth/callback&scope=mcp:read%20mcp:write&state=<state>
   ```
   The server auto-approves and redirects back with `?code=<authorization_code>`.

2. **Token Exchange**: Claude exchanges the code for an access token:
   ```
   POST https://mcp.myng.net/oauth/token
   Content-Type: application/json

   {
     "grant_type": "authorization_code",
     "code": "<authorization_code>",
     "redirect_uri": "https://mcp.myng.net/oauth/callback",
     "client_id": "quill-mcp-client",
     "client_secret": "quill-mcp-secret-change-me"
   }
   ```

3. **MCP Request**: Claude sends the Bearer token with each MCP call:
   ```
   Authorization: Bearer <access_token>
   Content-Type: application/json

   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/call",
     "params": { "name": "research", "arguments": { "topic": "climate change" } }
   }
   ```

4. **Refresh Token**: Use `grant_type=refresh_token` with the same client credentials to get a new access token.

### Claude Desktop Config

```json
{
  "mcpServers": {
    "quill-research": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/remote-mcp-client", "https://mcp.myng.net/mcp"]
    }
  }
}
```

When Claude connects, it will discover the OAuth metadata, initiate the authorization flow, and automatically attach `Authorization: Bearer <token>` to all MCP requests.

## Connect Quill

Set in your Quill `.env.local` / Vercel env:

```
MCP_SERVER_URL=https://your-domain.com
```

Quill calls `POST /mcp/research` (or GET) to harvest papers during the writing pipeline.

## Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/mcp` | GET | MCP server info / discovery (no auth) |
| `/mcp` | POST | MCP JSON-RPC 2.0 (requires `Authorization: Bearer <token>`) |
| `/.well-known/oauth-authorization-server` | GET | OAuth server metadata for Claude |
| `/oauth/authorize` | GET | OAuth authorization endpoint (auto-approve) |
| `/oauth/callback` | GET | OAuth redirect callback |
| `/oauth/token` | POST | OAuth token exchange (code → access token) |
| `/mcp/research` | GET | `?topic=...&limit=...` — simple research REST |
| `/mcp/research` | POST | JSON body `{topic, limit}` — research REST |
| `/health` | GET | Health check |

## Example GET Research

```bash
curl "https://your-domain.com/mcp/research?topic=climate%20change&limit=5"
```

## Example MCP tools/call

```json
POST /mcp
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "research",
    "arguments": { "topic": "large language models", "limit": 10 }
  }
}
```

## Security

Cloudflare tunnel credentials are pre-baked into `config.js` for direct deployment. The OAuth client secret (`OAUTH_CLIENT_SECRET`) should be changed in production. Do not commit `.env` files or share tunnel tokens publicly.

