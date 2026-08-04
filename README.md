# mcp-va-museum

Victoria and Albert Museum (V&A) Collections MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_objects` | Search the Victoria & Albert Museum (V&A) — the world's leading art & design museum. Find objects across 1M+ items (furniture, fashion, ceramics, photographs, paintings, jewellery, sculpture) by keyword. Returns id, title, maker, date, place, type, and thumbnail. Use the returned id with get_object for full details. Keyless. |
| `get_object` | Get the full record for a single V&A object by its system number (e.g. "O72610", as returned by search_objects). Returns title, maker, object type, materials, description, date, place, dimensions, and a usable image URL. Keyless. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "va-museum": {
      "url": "https://gateway.pipeworx.io/va-museum/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Va Museum data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
