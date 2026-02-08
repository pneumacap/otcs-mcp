# OTCS Migration Toolkit

A production-grade, bi-directional content migration system for OpenText Content Server. Designed for bulk transfers between local filesystems and OTCS with enterprise features including concurrent processing, checkpoint recovery, AI-powered conflict resolution, and chain of custody reporting.

## Overview

The migration toolkit orchestrates document transfers through a 7-phase pipeline:

```
1. Initialize  -> Load configuration and authenticate to OTCS
2. Discover    -> Scan source and destination, compute diff
3. Resolve     -> Apply conflict resolution strategy
4. Transfer    -> Execute uploads/downloads with retry and concurrency
5. Verify      -> Validate transferred files match source
6. Report      -> Generate chain of custody documentation
7. Cleanup     -> Save checkpoint and logout
```

## Key Features

- **Bi-directional transfers** - Upload to OTCS or download from OTCS to local filesystem
- **Concurrent processing** - Configurable parallelism (1-100 concurrent transfers)
- **Checkpoint and resume** - Automatically saves progress; resume interrupted migrations
- **AI-powered conflict resolution** - Uses Claude to intelligently resolve file conflicts
- **Post-transfer verification** - Validates transferred files exist and sizes match
- **Chain of custody reports** - JSON reports with optional AI-generated summaries
- **Dry-run mode** - Preview changes without transferring files
- **Extension filtering** - Migrate only specific file types
- **Retry with backoff** - Failed transfers retry with exponential backoff

## Quick Start

### 1. Prerequisites

Create a `.env` file in the project root:

```bash
OTCS_BASE_URL=https://your-otcs-server.com/cs/cs
OTCS_USERNAME=your_username
OTCS_PASSWORD=your_password
ANTHROPIC_API_KEY=your_key  # Optional: enables AI conflict resolution and report summaries
```

### 2. Configure Migration Jobs

Create or edit `migration/migration-config.json`:

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
# Preview migration (dry run)
npm run migration -- --job "Upload documents to OTCS" --dry-run

# Execute migration
npm run migration -- --job "Upload documents to OTCS"

# Resume interrupted migration
npm run migration -- --job "Upload documents to OTCS" --resume

# Run all configured jobs
npm run migration -- --all

# Override concurrency
npm run migration -- --job "Upload documents to OTCS" --concurrency 50
```

Alternatively, run directly with tsx:

```bash
tsx migration/runner.ts --job "Upload documents to OTCS"
```

## Configuration Reference

### Job Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique job identifier |
| `direction` | string | Yes | Transfer direction: `local-to-otcs` or `otcs-to-local` |
| `source` | string \| number | Yes | Local path (for upload) or OTCS node ID (for download) |
| `destination` | number \| string | Yes | OTCS node ID (for upload) or local path (for download) |
| `recursive` | boolean | Yes | Include subdirectories and their contents |
| `extensions` | string[] | No | File extensions to include (empty array = all files) |
| `concurrency` | number | Yes | Number of parallel transfers (1-100) |
| `retries` | number | Yes | Number of retry attempts per file |
| `conflictStrategy` | string | Yes | How to handle conflicts: `skip`, `overwrite`, `rename`, or `agent` |
| `verify` | boolean | Yes | Run verification pass after transfer |
| `generateReport` | boolean | Yes | Generate chain of custody report |
| `reportDestination` | number | No | OTCS folder ID for automatic report upload |

### Conflict Resolution Strategies

| Strategy | Behavior |
|----------|----------|
| `skip` | Keep destination version, do not transfer source file |
| `overwrite` | Replace destination with source file |
| `rename` | Upload with timestamp suffix (e.g., `file_2024-01-15T10-30-00.pdf`) |
| `agent` | Use Claude AI to decide per-file based on metadata (requires `ANTHROPIC_API_KEY`) |

When using `agent` strategy, Claude analyzes conflicts considering:
- File modification dates (source vs destination)
- Size differences
- File importance based on name and type
- Returns decisions: `skip`, `overwrite`, or `rename:newname.ext`

## Command Line Options

```
Usage:
  npm run migration -- [options]

Options:
  --job, -j <name>       Run a specific job by name
  --all, -a              Run all jobs in sequence
  --dry-run              Scan and report without transferring files
  --concurrency, -c <n>  Override job concurrency setting
  --resume, -r           Resume from last checkpoint
  --help, -h             Show help message
```

## Example Configurations

### Download from OTCS to Local

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

### High-throughput Bulk Upload

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

### AI-Powered Smart Sync

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

## Output and Logging

All logs, checkpoints, and reports are saved to `migration/logs/`:

| File | Description |
|------|-------------|
| `checkpoint-{job}.json` | Resume state with completed files and node ID mappings |
| `report-{job}-{timestamp}.json` | Structured JSON report with complete audit trail |
| `report-{job}-{timestamp}.txt` | Human-readable chain of custody report |

### Log Files

The toolkit uses structured logging with multiple output formats:

- Console output shows real-time progress with transfer rates and ETA
- JSON log entries for programmatic processing
- File-level status logs for detailed troubleshooting

## Verification

When `verify: true`, the system performs post-transfer validation:

### Upload Verification (local-to-otcs)
- Confirms OTCS node exists at expected node ID
- Validates file size matches source file
- Records verification pass/fail in report

### Download Verification (otcs-to-local)
- Confirms local file exists at expected path
- Validates file size matches OTCS node size
- Records verification pass/fail in report

**Note:** OTCS REST API does not provide content checksums, so verification is size-based only. Files with identical size but different content will pass verification.

## Chain of Custody Reports

Generated reports include:

### Executive Summary
- AI-generated migration overview (when `ANTHROPIC_API_KEY` is configured)
- High-level statistics and key findings
- Migration success rate and recommendations

### Migration Statistics
- Total files processed
- Files transferred, skipped, failed
- Total data transferred (MB/GB)
- Performance metrics (files/sec, MB/sec)
- Duration and timestamps

### Conflict Resolution Log
- How each conflict was handled
- File-by-file resolution decisions
- Reasons for skip/overwrite/rename actions

### Verification Results
- Pass/fail status for each transferred file
- Size comparison details
- Failed verification diagnostics

### Complete File Manifest
- Source path and size
- Destination path and node ID
- Transfer status and timestamp
- Error messages for failed transfers

### Report Upload

When `reportDestination` is configured, both JSON and text reports are automatically uploaded to the specified OTCS folder as documents.

## Error Handling and Recovery

### Retry Mechanism
- Failed transfers retry with exponential backoff
- Default backoff: 1s, 2s, 4s (configurable via `retries` setting)
- Network errors, timeouts, and server errors trigger retry
- Permanent failures (authentication, permission denied) skip retry

### Checkpoint Recovery
- Progress is saved after each successful transfer
- Use `--resume` flag to continue from last checkpoint
- Checkpoint includes completed files and OTCS node ID mappings
- Corrupted checkpoints automatically start fresh

### Graceful Shutdown
- SIGINT (Ctrl+C) and SIGTERM save checkpoint before exit
- In-flight transfers complete before shutdown
- Partial uploads are not cleaned up (resume will skip them)

### Folder Creation
- Missing destination folders are created automatically
- Preserves source folder structure in destination
- Parent folder creation fails if insufficient permissions

## Architecture

### Module Reference

| Module | Purpose |
|--------|---------|
| `runner.ts` | Main orchestrator, CLI entry point, phase coordinator |
| `config.ts` | Configuration loading, environment variable parsing, CLI argument handling |
| `discovery.ts` | Source/destination scanning, diff computation, file metadata extraction |
| `transfer.ts` | Upload/download engine with concurrent processing and checkpoint management |
| `verify.ts` | Post-transfer verification pass with size validation |
| `report.ts` | Chain of custody report generation with optional AI summaries |
| `logger.ts` | Structured logging utilities with multiple output formats |

### Dependencies

- **@otcs/core** - OTCS REST API client (imported from `packages/core`)
- **@anthropic-ai/sdk** - Claude AI client for conflict resolution and report generation
- Node.js built-ins: `fs`, `path` for filesystem operations

### Transfer Pipeline

1. **Manifest generation** - Discovery phase creates a manifest of all files with diff status
2. **Conflict resolution** - Applies strategy to files with `modified` status
3. **Queue processing** - Files are queued based on status (new, modified with overwrite/rename)
4. **Concurrent execution** - Pool of workers processes queue with configurable concurrency
5. **Checkpoint updates** - Each successful transfer updates checkpoint for resume capability
6. **Progress tracking** - Real-time console output with rates, ETA, and byte transfer stats

## Performance Tips

1. **Optimize concurrency** - Network-bound migrations benefit from higher concurrency (30-50)
2. **Use extension filters** - Avoid scanning/transferring unnecessary files with `extensions` array
3. **Run during off-peak hours** - Large migrations can impact OTCS server performance
4. **Dry-run first** - Always preview scope and estimate time with `--dry-run` before execution
5. **Enable resume** - For migrations with thousands of files, checkpoint/resume prevents data loss
6. **Monitor logs** - Watch `migration/logs/` for real-time progress and error diagnostics
7. **Start small** - Test with a small batch before migrating thousands of files

## Troubleshooting

### Common Issues

**Authentication failures**
- Verify `OTCS_BASE_URL`, `OTCS_USERNAME`, `OTCS_PASSWORD` in `.env`
- Check OTCS server is accessible from your network
- Confirm user has required permissions on source/destination folders

**Permission denied errors**
- Verify user has `Create` permission on destination folder
- For downloads, check local filesystem write permissions
- OTCS folder permissions may differ from document permissions

**Out of memory errors**
- Reduce concurrency to lower value (5-10)
- Process large migrations in smaller batches
- Verify system has adequate RAM for concurrent operations

**Network timeouts**
- Increase retry count for unstable networks
- Reduce concurrency to minimize server load
- Check OTCS server performance and network bandwidth

**Verification failures**
- Size mismatches may indicate incomplete uploads (retry upload)
- OTCS may modify files during upload (compression, virus scanning)
- Re-run verification pass separately if needed

## License

Part of the OTCS MCP project.
