const express = require("express")
const cors = require("cors")
const { spawn } = require("node:child_process")

const app = express()
let PORT = process.env.PORT || 20150

app.use(cors())
app.use(express.json({ limit: "1mb" }))

let config = null
let cloudflareConnected = false
let cloudflareLogBuffer = ""
let cloudflareChild = null
let restartTimer
let shuttingDown = false

function clean(text) {
  return text.replace(/\s+/g, " ").trim()
}

function decodeInvertedAbstract(index) {
  if (!index) return ""
  const words = []
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) words[pos] = word
  }
  return words.filter(Boolean).join(" ")
}

async function searchOpenAlex(query, limit) {
  const year = new Date().getFullYear()
  const url = new URL("https://api.openalex.org/works")
  url.searchParams.set("search", query)
  url.searchParams.set("filter", `from_publication_date:${year - 4}-01-01`)
  url.searchParams.set("sort", "cited_by_count:desc")
  url.searchParams.set("per_page", String(Math.min(limit, 50)))
  url.searchParams.set(
    "select",
    "id,display_name,publication_year,cited_by_count,doi,authorships,primary_location,abstract_inverted_index,open_access"
  )

  const res = await fetch(url.toString(), { headers: { "User-Agent": config.ua } })
  if (!res.ok) return []
  const data = await res.json()
  const results = Array.isArray(data.results) ? data.results : []

  return results.map((work) => {
    const authorships = work.authorships || []
    const loc = work.primary_location || {}
    const oa = work.open_access || {}
    return {
      id: String(work.id || ""),
      title: clean(String(work.display_name || "Untitled")),
      year: Number(work.publication_year) || year,
      authors: authorships
        .map((a) => a.author?.display_name || "Unknown")
        .filter(Boolean)
        .slice(0, 8),
      doi: work.doi ? String(work.doi).replace("https://doi.org/", "") : undefined,
      venue: loc.source?.display_name,
      citedBy: Number(work.cited_by_count) || 0,
      abstract: clean(decodeInvertedAbstract(work.abstract_inverted_index)),
      url: loc.landing_page_url || (work.doi ? String(work.doi) : undefined),
      pdfUrl: loc.pdf_url,
      isOa: Boolean(loc.is_oa || oa.is_oa),
      origin: "openalex",
    }
  })
}

async function searchCrossref(query, limit) {
  const url = new URL("https://api.crossref.org/works")
  url.searchParams.set("query", query)
  url.searchParams.set("rows", String(Math.min(limit, 40)))
  url.searchParams.set("sort", "published")
  url.searchParams.set("order", "desc")
  url.searchParams.set("mailto", config.mailto)
  url.searchParams.set("filter", `from-pub-date:${new Date().getFullYear() - 4}`)

  const res = await fetch(url.toString(), { headers: { "User-Agent": config.ua } })
  if (!res.ok) return []
  const data = await res.json()
  const items = data?.message?.items || []

  return items.map((item) => {
    const titleArr = item.title || []
    const authorArr = item.author || []
    const container = item["container-title"] || []
    const issued = item.issued || {}
    const year = (issued["date-parts"]?.[0]?.[0] || new Date().getFullYear())
    const abstractHtml = typeof item.abstract === "string" ? item.abstract : ""
    return {
      id: `crossref:${item.DOI || titleArr[0] || Math.random()}`,
      title: clean(titleArr[0] || "Untitled"),
      year: Number(year),
      authors: authorArr
        .map((a) => [a.given, a.family].filter(Boolean).join(" "))
        .filter(Boolean)
        .slice(0, 8),
      doi: item.DOI ? String(item.DOI) : undefined,
      venue: container[0],
      citedBy: Number(item["is-referenced-by-count"]) || 0,
      abstract: clean(abstractHtml.replace(/<[^>]+>/g, " ")),
      url: item.URL ? String(item.URL) : item.DOI ? `https://doi.org/${item.DOI}` : undefined,
      isOa: false,
      origin: "crossref",
    }
  })
}

async function harvestSources(topic, limit = 24) {
  const [oa, cr] = await Promise.allSettled([
    searchOpenAlex(topic, limit),
    searchCrossref(topic, Math.ceil(limit / 2)),
  ])
  const papers = [
    ...(oa.status === "fulfilled" ? oa.value : []),
    ...(cr.status === "fulfilled" ? cr.value : []),
  ]
  const seen = new Set()
  const unique = []
  for (const p of papers) {
    const key = (p.doi || p.title).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    if (!p.title || p.title.length < 6) continue
    unique.push(p)
  }
  unique.sort((a, b) => b.year - a.year || b.citedBy - a.citedBy)
  return unique.slice(0, limit)
}

// ---------- MCP Protocol (JSON-RPC 2.0) at /mcp ----------

const TOOLS = [
  {
    name: "research",
    description:
      "Search recent academic journals and papers for a topic. Returns a ranked list of sources from OpenAlex and Crossref with title, authors, year, venue, citation count, abstract, DOI, and open-access status.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "The research topic or research question to search for",
        },
        limit: {
          type: "number",
          description: "Maximum number of papers to return (default 24, max 50)",
          default: 24,
        },
      },
      required: ["topic"],
    },
  },
]

function jsonrpcError(id, code, message, data) {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data ? { data } : {}) } }
}

function jsonrpcResult(id, result) {
  return { jsonrpc: "2.0", id, result }
}

app.get("/mcp", (req, res) => {
  // GET for MCP over HTTP discovery / SSE handshake
  res.json({
    jsonrpc: "2.0",
    id: null,
    result: {
      protocolVersion: config.protocolVersion,
      capabilities: {
        logging: {},
        tools: { listChanged: false },
        resources: {},
        prompts: {},
      },
      serverInfo: {
        name: config.serviceName,
        version: config.serviceVersion,
      },
      endpoints: {
        mcp: "POST /mcp",
        research: "GET /mcp/research?topic=...&limit=...",
        health: "GET /health",
      },
    },
  })
})

app.post("/mcp", async (req, res) => {
  // ---------- OAuth Bearer token validation ----------
  const auth = req.headers.authorization || ""
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return res.status(401).json({ error: "Missing Bearer token" })
  }
  const entry = config.validateAccessToken(match[1])
  if (!entry) {
    return res.status(401).json({ error: "Invalid or expired token" })
  }

  const { jsonrpc, id, method, params } = req.body || {}

  if (jsonrpc !== "2.0") {
    return res.status(400).json(jsonrpcError(id, -32600, "Invalid Request"))
  }

  try {
    // ---------- Lifecycle ----------
    if (method === "initialize") {
      const result = {
        protocolVersion: config.protocolVersion,
        capabilities: {
          logging: {},
          tools: { listChanged: false },
          resources: {},
          prompts: {},
        },
        serverInfo: {
          name: config.serviceName,
          version: config.serviceVersion,
        },
      }
      return res.json(jsonrpcResult(id, result))
    }

    if (method === "notifications/initialized") {
      // Notification: no response body needed, but acknowledge with 204
      return res.status(204).end()
    }

    if (method === "ping") {
      return res.json(jsonrpcResult(id, {}))
    }

    // ---------- Tools ----------
    if (method === "tools/list") {
      return res.json(jsonrpcResult(id, { tools: TOOLS }))
    }

    if (method === "tools/call") {
      const { name, arguments: args } = params || {}
      if (name === "research") {
        const topic = args && args.topic
        const limit = args && args.limit ? Math.min(Number(args.limit), 50) : 24
        if (!topic || typeof topic !== "string") {
          return res.json(
            jsonrpcResult(id, {
              content: [{ type: "text", text: "Error: topic is required" }],
              isError: true,
            })
          )
        }
        const papers = await harvestSources(topic, limit)
        const text = formatResearchResults(topic, papers)
        return res.json(
          jsonrpcResult(id, {
            content: [{ type: "text", text }],
            isError: false,
          })
        )
      }
      return res.json(jsonrpcError(id, -32602, `Unknown tool: ${name}`))
    }

    return res.json(jsonrpcError(id, -32601, `Method not found: ${method}`))
  } catch (err) {
    console.error(err)
    return res.status(500).json(jsonrpcError(id, -32603, "Internal error", String(err.message || err)))
  }
})

function formatResearchResults(topic, papers) {
  if (!papers.length) {
    return `No recent papers found for: ${topic}`
  }
  let out = `Recent journal research for "${topic}" — ${papers.length} papers:\n\n`
  papers.forEach((p, i) => {
    out += `${i + 1}. ${p.title} (${p.year})\n`
    if (p.authors.length) out += `   Authors: ${p.authors.slice(0, 6).join(", ")}\n`
    if (p.venue) out += `   Venue: ${p.venue}\n`
    if (p.citedBy) out += `   Citations: ${p.citedBy}\n`
    if (p.doi) out += `   DOI: ${p.doi}\n`
    if (p.url) out += `   URL: ${p.url}\n`
    if (p.pdfUrl) out += `   PDF: ${p.pdfUrl}\n`
    if (p.isOa) out += `   Open Access: Yes\n`
    if (p.abstract) out += `   Abstract: ${p.abstract.slice(0, 400)}...\n`
    out += "\n"
  })
  return out
}

// ---------- Simple REST for Quill ----------
app.get("/health", (req, res) => {
  res.json({ ok: true, service: config.serviceName, protocol: config.protocolVersion })
})

app.get("/mcp/research", async (req, res) => {
  try {
    const { topic, limit = 24 } = req.query
    if (!topic || typeof topic !== "string") {
      return res.status(400).json({ error: "topic is required" })
    }
    const papers = await harvestSources(topic, Math.min(Number(limit), 50))
    res.json({ ok: true, topic, count: papers.length, papers })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: String(err.message || err) })
  }
})

app.post("/mcp/research", async (req, res) => {
  try {
    const { topic, limit = 24 } = req.body || {}
    if (!topic || typeof topic !== "string") {
      return res.status(400).json({ error: "topic is required" })
    }
    const papers = await harvestSources(topic, Math.min(Number(limit), 50))
    res.json({ ok: true, topic, count: papers.length, papers })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: String(err.message || err) })
  }
})

// ---------- OAuth (Claude remote MCP connector) ----------

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || ""
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return res.status(401).json({ error: "Missing Bearer token" })
  }
  const entry = config.validateAccessToken(match[1])
  if (!entry) {
    return res.status(401).json({ error: "Invalid or expired token" })
  }
  req.oauth = entry
  next()
}

app.get("/.well-known/oauth-authorization-server", (req, res) => {
  res.json({
    issuer: config.publicBaseUrl,
    authorization_endpoint: `${config.publicBaseUrl}/oauth/authorize`,
    token_endpoint: `${config.publicBaseUrl}/oauth/token`,
    registration_endpoint: `${config.publicBaseUrl}/oauth/register`,
    scopes_supported: config.oauthScopes.split(" "),
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
  })
})

app.get("/oauth/authorize", (req, res) => {
  const { response_type, client_id, redirect_uri, scope, state, code_challenge, code_challenge_method } = req.query
  if (response_type !== "code") {
    return res.status(400).send("Unsupported response_type")
  }
  if (client_id !== config.oauthClientId) {
    return res.status(400).send("Unknown client_id")
  }
  // Auto-approve for Claude connector (no interactive login)
  const code = Buffer.from(`${Date.now()}:${Math.random().toString(36).slice(2)}:${client_id}`).toString("base64url")
  const redirect = new URL(redirect_uri)
  redirect.searchParams.set("code", code)
  if (state) redirect.searchParams.set("state", state)
  res.redirect(redirect.toString())
})

app.get("/oauth/callback", (req, res) => {
  const { code } = req.query
  if (!code) return res.status(400).send("Missing code")
  res.send(`<html><body><script>window.opener?.postMessage({oauthCode: "${code}"}, "*"); window.close();</script>OAuth complete. You can close this window.</body></html>`)
})

app.post("/oauth/token", async (req, res) => {
  const { grant_type, code, redirect_uri, client_id, client_secret, refresh_token } = req.body || {}
  if (grant_type === "authorization_code") {
    if (client_id !== config.oauthClientId || client_secret !== config.oauthClientSecret) {
      return res.status(401).json({ error: "invalid_client" })
    }
    const token = config.issueAccessToken(config.oauthScopes, client_id)
    return res.json({
      access_token: token,
      token_type: "Bearer",
      expires_in: 3600,
      scope: config.oauthScopes,
    })
  }
  if (grant_type === "refresh_token") {
    if (!config.oauthAccessTokens.has(refresh_token)) {
      return res.status(401).json({ error: "invalid_grant" })
    }
    const newToken = config.issueAccessToken(config.oauthScopes, client_id || config.oauthClientId)
    config.oauthAccessTokens.delete(refresh_token)
    return res.json({
      access_token: newToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: config.oauthScopes,
    })
  }
  return res.status(400).json({ error: "unsupported_grant_type" })
})

// Protect MCP POST with bearer token (GET /mcp discovery stays open)
// Auth check is inline in app.post("/mcp") handler above.

// ---------- Cloudflare Tunnel (Movieboxapi-proxy pattern) ----------

function resolveCloudflaredBinary() {
  if (config.cloudflaredBinary) return config.cloudflaredBinary
  const path = require("node:path")
  const fs = require("node:fs")
  const localBinary = path.resolve(process.cwd(), "node_modules", ".bin", "cloudflared")
  if (fs.existsSync(localBinary)) return localBinary
  return "cloudflared"
}

function startCloudflare() {
  if (shuttingDown || cloudflareChild || !config.cloudflareTunnelToken) return

  const command = resolveCloudflaredBinary()
  console.log(`[cloudflare] Starting token connector for ${config.cloudflareTunnelId}; origin=${config.cloudflareServiceUrl}`)

  const { CLOUDFLARE_TUNNEL_TOKEN: _cloudflareToken, ...safeProcessEnv } = process.env
  const child = spawn(command, ["tunnel", "--no-autoupdate", "run", "--url", config.cloudflareServiceUrl], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...safeProcessEnv, TUNNEL_TOKEN: config.cloudflareTunnelToken },
  })
  cloudflareChild = child

  const handleCloudflareOutput = (chunk, stream) => {
    const text = chunk.toString()
    cloudflareLogBuffer = `${cloudflareLogBuffer}${text}`.slice(-8192)

    if (!cloudflareConnected && /registered tunnel connection|connection .*registered|tunnel connection established/i.test(cloudflareLogBuffer)) {
      cloudflareConnected = true
      console.log(`[cloudflare] Connected to tunnel ${config.cloudflareTunnelId} for ${config.publicBaseUrl}`)
      printTunnelBanner()
    }

    if (/provided tunnel token is not valid|authentication failed|unauthorized/i.test(text)) {
      console.error("[cloudflare] Authentication failed; rotate CLOUDFLARE_TUNNEL_TOKEN and update the environment secret")
    }

    process[stream].write(`[cloudflare] ${text}`)
  }

  child.stdout.on("data", (chunk) => handleCloudflareOutput(chunk, "stdout"))
  child.stderr.on("data", (chunk) => handleCloudflareOutput(chunk, "stderr"))
  child.on("error", (error) => console.error(`[cloudflare] Failed to start: ${error.message}`))
  child.on("exit", (code, signal) => {
    if (cloudflareChild === child) cloudflareChild = null
    cloudflareConnected = false
    cloudflareLogBuffer = ""

    if (!shuttingDown) {
      console.error(`[cloudflare] Connector stopped (code=${code ?? "none"}, signal=${signal ?? "none"}); restarting in 5s`)
      clearTimeout(restartTimer)
      restartTimer = setTimeout(startCloudflare, 5000)
    }
  })
}

function printTunnelBanner() {
  console.log("\n╔══════════════════════════════════════════════════════════╗")
  console.log("║        CLOUDFLARE TUNNEL IS CONNECTED                   ║")
  console.log("╠══════════════════════════════════════════════════════════╣")
  console.log(`║  Domain: ${config.publicBaseUrl.padEnd(43)}║`)
  console.log(`║  Tunnel: ${config.cloudflareTunnelId.padEnd(43)}║`)
  console.log("╚══════════════════════════════════════════════════════════╝\n")
}

function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  clearTimeout(restartTimer)
  console.log(`[startup] Received ${signal}; stopping server and Cloudflare connector`)
  if (cloudflareChild) cloudflareChild.kill("SIGTERM")
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 1000).unref()
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

// ---------- Bootstrap ----------

;(async () => {
  const configModule = await import("./config.js")
  config = configModule.default || configModule
  PORT = config.port

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Quill MCP server listening on 0.0.0.0:${PORT}`)
    console.log(`  MCP endpoint:    GET/POST http://localhost:${PORT}/mcp`)
    console.log(`  REST research:   GET/POST http://localhost:${PORT}/mcp/research`)
    console.log(`  Health:          GET  http://localhost:${PORT}/health`)
    if (config.cloudflareTunnelToken) {
      startCloudflare()
    } else {
      console.warn("[cloudflare] CLOUDFLARE_TUNNEL_TOKEN is not set; running without a tunnel connector")
    }
  })
})()
