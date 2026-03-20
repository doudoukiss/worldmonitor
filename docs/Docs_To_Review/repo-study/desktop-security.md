# Desktop Runtime And Security Boundary

## Desktop Is A Separate Runtime

The desktop app is not just a webview around the website.

It adds:

- a Rust Tauri shell
- a local Node.js API sidecar
- OS keyring integration
- local bearer token auth
- runtime fetch patching
- extra network safety logic

## Tauri Shell Responsibilities

`src-tauri/src/main.rs` handles a lot of privileged work:

- secret storage and migration into a consolidated keyring vault
- sidecar process lifecycle
- local API port and token management
- trusted-window checks for IPC commands
- persistent local cache management
- window/menu setup

Three trusted windows are hard-coded:

- `main`
- `settings`
- `live-channels`

That is an explicit trust boundary, not an incidental UI detail.

## Sidecar Responsibilities

`src-tauri/sidecar/local-api-server.mjs` dynamically loads handler modules from
`api/` and runs them locally.

Important behaviors observed in code:

- monkey-patches `globalThis.fetch` to force IPv4
- imposes a global concurrency limit for upstream requests
- rate-gates Yahoo Finance requests
- validates outbound URLs to reduce SSRF risk
- injects environment-backed secrets for approved keys only

The IPv4 patch is there for a concrete reason: some government and market data
providers expose broken IPv6 paths.

## Renderer Fetch Patching

The browser-side desktop glue lives in `src/services/runtime.ts`.

Key points:

- desktop runtime detection is defensive and multi-signal
- `/api/*` requests can be redirected to the local sidecar
- the sidecar port is resolved dynamically
- the renderer can fall back to cloud APIs if local access fails

This matters because the desktop app is not pinned to one static local port or
one static API base string.

## Security Controls Seen In Code

### Window trust checks

Tauri commands use trusted-window validation before returning local tokens or
runtime info.

### Secret allowlist

Both Rust and sidecar code maintain explicit lists of supported secret keys.

### Local auth token

The local sidecar flow uses a generated token rather than exposing an open local
server.

### SSRF protection

The sidecar rejects:

- non-HTTP protocols
- credentialed URLs
- localhost and private network targets
- DNS results that resolve to private or reserved ranges

### Desktop-specific CSP handling

`vite.config.ts` injects desktop-specific CSP allowances for the dynamic
localhost sidecar port during desktop builds.

## Practical Consequences

1. Desktop bugs often need investigation across Rust, sidecar JS, and browser
   runtime code together.
2. Secret-related work is concentrated in the desktop path, not the browser path.
3. Any feature that adds local IPC or sidecar networking should be reviewed as a
   security-sensitive change, not as a normal frontend tweak.
