import { resolve } from "node:path"
import { existsSync } from "node:fs"

const root = resolve(process.cwd())

export const port = Number(process.env.PORT || 20150)
export const publicBaseUrl = process.env.PUBLIC_BASE_URL || "https://mcp.myng.net"
export const cloudflareTunnelId = process.env.CLOUDFLARE_TUNNEL_ID || "acc4a5dc-817f-479f-a18b-7543214f357e"
export const cloudflareTunnelToken = process.env.CLOUDFLARE_TUNNEL_TOKEN || "eyJhIjoiNWRjZTRiM2Q3YjUxNTBhNzcxNGFhMjBkMjk5MjY0YTQiLCJ0IjoiYWNjNGE1ZGMtODE3Zi00NzlmLWExOGItNzU0MzIxNGYzNTdlIiwicyI6Ik5tSXpPRGM1WlRJdFpqUTFaQzAwTTJKaExUZzFORE10TkRVNVptRXhNVGd3TjJZMiJ9"
export const cloudflareServiceUrl = process.env.CLOUDFLARE_SERVICE_URL || `http://127.0.0.1:${port}`
export const cdnUserAgent = process.env.CDN_USER_AGENT || "Quill-MCP/1.0"
export const referer = process.env.REFERER_DOMAIN || "https://mcp.myng.net/"
export const proxyClientIp = process.env.PROXY_CLIENT_IP || ""
export const cloudflaredBinary = process.env.CLOUDFLARED_BINARY || null
export const serviceName = process.env.MCP_SERVICE_NAME || "quill-mcp-research"
export const serviceVersion = process.env.MCP_SERVICE_VERSION || "1.0.0"
export const protocolVersion = process.env.MCP_PROTOCOL_VERSION || "2024-11-05"
export const ua = `Quill-MCP/${serviceVersion} (mailto:research@quill.app)`
export const mailto = process.env.MCP_MAILTO || "research@quill.app"

// ---------- OAuth (Claude remote MCP connector) ----------
export const oauthClientId = process.env.OAUTH_CLIENT_ID || "quill-mcp-client"
export const oauthClientSecret = process.env.OAUTH_CLIENT_SECRET || "quill-mcp-secret-change-me"
export const oauthRedirectUri = process.env.OAUTH_REDIRECT_URI || `${publicBaseUrl}/oauth/callback`
export const oauthScopes = process.env.OAUTH_SCOPES || "mcp:read mcp:write"
export const oauthAccessTokens = new Map() // accessToken -> { scopes, clientId, expiresAt }

export function issueAccessToken(scopes, clientId, ttlMs = 3600000) {
  const token = Buffer.from(`${Date.now()}:${Math.random().toString(36).slice(2)}`).toString("base64url")
  oauthAccessTokens.set(token, { scopes, clientId, expiresAt: Date.now() + ttlMs })
  return token
}

export function validateAccessToken(token) {
  const entry = oauthAccessTokens.get(token)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    oauthAccessTokens.delete(token)
    return null
  }
  return entry
}

export function resolveCloudflaredBinary() {
  if (cloudflaredBinary) return cloudflaredBinary
  const localBinary = resolve(root, "node_modules", ".bin", "cloudflared")
  if (existsSync(localBinary)) return localBinary
  return "cloudflared"
}

export default {
  port,
  publicBaseUrl,
  cloudflareTunnelId,
  cloudflareTunnelToken,
  cloudflareServiceUrl,
  cdnUserAgent,
  referer,
  proxyClientIp,
  cloudflaredBinary,
  serviceName,
  serviceVersion,
  protocolVersion,
  ua,
  mailto,
  oauthClientId,
  oauthClientSecret,
  oauthRedirectUri,
  oauthScopes,
  oauthAccessTokens,
  issueAccessToken,
  validateAccessToken,
  resolveCloudflaredBinary,
}
