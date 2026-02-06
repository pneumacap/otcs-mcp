# OTCS Migration Toolkit

A production-grade, bi-directional content migration system for OpenText Content Server. Supports bulk transfers between local filesystems and OTCS with enterprise features including conflict resolution, verification, and chain of custody reporting.

## Features

- **Bi-directional transfers** — Upload to OTCS or download from OTCS
- **Concurrent processing** — Configurable parallelism (1-100 concurrent transfers)
- **Checkpoint & resume** — Automatically saves progress; resume interrupted migrations
- **AI-powered conflict resolution** — Uses Claude to intelligently resolve file conflicts
- **Post-transfer verification** — Validates transferred files match source
- **Chain of custody reports** — JSON + executive summary with optional OTCS upload
- **Dry-run mode** — Preview changes without transferring
- **Extension filtering** — Migrate only specific file types

## Architecture

The migration runs in 7 phases:

```
1. Initialize  → Load config, authenticate to OTCS
2. Discover    → Scan source and destination, compute diff
3. Resolve     → Apply conflict strategy (skip/overwrite/rename/agent)
4. Transfer    → Execute uploads/downloads with retry
5. Verify      → Confirm files exist and sizes match
6. Report      → Generate chain of custody documentation
7. Cleanup     → Save checkpoint, logout
```

## Quick Start

### 1. Configure Environment

Create a `.env` file in the project root:

```bash
OTCS_BASE_URL=https://your-otcs-server.com/cs/cs
OTCS_USERNAME=your_username
OTCS_PASSWORD=your_password
ANTHROPIC_API_KEY=your_key  # Optional: enables AI conflict resolution
```

### 2. Create Migration Config

Create `migration/migration-config.json`:

```json
{
  "jobs": [
    {
      "name": "Upload documents to OTCS",
      "direction": "local-to-otcs",
      "source": "~/Documents/to-migrate",
      "destination": 12345,
      "recursive": true,
      "extensions": [".pdf", ".docx", ".xlsx"],
      "concurrency": 10,
      "retries": 3,
      "conflictStrategy": "skip",
      "verify": true,
      "generateReport": true,
      "reportDestination": 67890
    }
  ]
}
```

### 3. Run Migration

```bash
# Preview (dry run)
npm run migration:dry -- --job "Upload documents to OTCS"

# Execute migration
npm run migration -- --job "Upload documents to OTCS"

# Resume interrupted migration
npm run migration -- --job "Upload documents to OTCS" --resume

# Run all jobs
npm run migration -- --all
```

## Configuration Reference

### Job Configuration

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique job identifier |
| `direction` | `local-to-otcs` \| `otcs-to-local` | Transfer direction |
| `source` | string \| number | Local path (for upload) or OTCS node ID (for download) |
| `destination` | number \| string | OTCS node ID (for upload) or local path (for download) |
| `recursive` | boolean | Include subdirectories |
| `extensions` | string[] | File extensions to include (empty = all files) |
| `concurrency` | number | Parallel transfers (1-100) |
| `retries` | number | Retry attempts per file |
| `conflictStrategy` | string | How to handle conflicts (see below) |
| `verify` | boolean | Run verification pass after transfer |
| `generateReport` | boolean | Generate chain of custody report |
| `reportDestination` | number | OTCS folder ID for report upload |

### Conflict Strategies

| Strategy | Behavior |
|----------|----------|
| `skip` | Keep destination version, don't transfer |
| `overwrite` | Replace destination with source |
| `rename` | Upload with timestamp suffix (e.g., `file_2024-01-15T10-30-00.pdf`) |
| `agent` | Use Claude AI to decide per-file (requires `ANTHROPIC_API_KEY`) |

## CLI Options

```
Usage:
  npm run migration -- [options]

Options:
  --job, -j <name>       Run a specific job by name
  --all, -a              Run all jobs in sequence
  --dry-run              Scan and report without transferring
  --concurrency, -c <n>  Override concurrency level
  --resume, -r           Resume from last checkpoint
  --help, -h             Show help
```

## Example Configurations

### Download from OTCS

```json
{
  "name": "Download legal documents",
  "direction": "otcs-to-local",
  "source": 98765,
  "destination": "~/Downloads/legal-archive",
  "recursive": true,
  "concurrency": 20,
  "retries": 3,
  "conflictStrategy": "rename",
  "verify": true,
  "generateReport": true
}
```

### High-throughput Upload

```json
{
  "name": "Bulk archive upload",
  "direction": "local-to-otcs",
  "source": "/data/archives",
  "destination": 11111,
  "recursive": true,
  "extensions": [".pdf", ".tif", ".tiff"],
  "concurrency": 50,
  "retries": 5,
  "conflictStrategy": "overwrite",
  "verify": true,
  "generateReport": true,
  "reportDestination": 22222
}
```

### AI-Powered Conflict Resolution

```json
{
  "name": "Smart document sync",
  "direction": "local-to-otcs",
  "source": "~/shared-docs",
  "destination": 33333,
  "recursive": true,
  "concurrency": 10,
  "retries": 3,
  "conflictStrategy": "agent",
  "verify": true,
  "generateReport": true
}
```

When using `agent` strategy, Claude analyzes each conflict considering:
- File modification dates
- Size differences
- File importance (based on name/type)
- Returns decisions: `skip`, `overwrite`, or `rename:newname.ext`

## Output Files

All logs and reports are saved to `migration/logs/`:

| File | Description |
|------|-------------|
| `checkpoint-{job}.json` | Resume state with completed files |
| `report-{job}-{timestamp}.json` | Detailed structured report |
| `report-{job}-{timestamp}.txt` | Human-readable chain of custody |

## Verification

When `verify: true`, the system performs a post-transfer verification pass:

- **Uploads**: Confirms OTCS node exists and file size matches
- **Downloads**: Confirms local file exists and size matches

Note: OTCS doesn't provide checksums, so verification is size-based only.

## Chain of Custody Reports

Reports include:

- **Executive Summary** — AI-generated overview (if API key configured)
- **Migration Statistics** — Files transferred, skipped, failed
- **Conflict Resolution Log** — How each conflict was handled
- **Verification Results** — Pass/fail for each transferred file
- **Complete File Manifest** — Source path, destination, size, status

Reports can be automatically uploaded to OTCS when `reportDestination` is set.

## Error Handling

- **Retry with backoff** — Failed transfers retry with exponential backoff (1s, 2s, 4s)
- **Graceful shutdown** — SIGINT/SIGTERM saves checkpoint before exit
- **Checkpoint recovery** — Corrupted checkpoints start fresh
- **Folder creation** — Missing destination folders created automatically

## Module Reference

| Module | Purpose |
|--------|---------|
| `runner.ts` | Main orchestrator, CLI entry point |
| `config.ts` | Configuration loading and CLI parsing |
| `discovery.ts` | Source/destination scanning, diff computation |
| `transfer.ts` | Upload/download engine with checkpoint |
| `verify.ts` | Post-transfer verification |
| `report.ts` | Chain of custody report generation |
| `logger.ts` | Structured logging utilities |

## Performance Tips

1. **Increase concurrency** for network-bound migrations: `--concurrency 50`
2. **Use extension filters** to avoid transferring unnecessary files
3. **Run during off-peak hours** for large migrations
4. **Use dry-run first** to verify scope and estimate time
5. **Enable resume** for large migrations to recover from interruptions

## License

Part of the OTCS MCP project.
