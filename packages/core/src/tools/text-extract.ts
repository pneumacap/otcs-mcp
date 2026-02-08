/**
 * Text content extraction for common document types.
 * Single source of truth — replaces duplicated copies in index.ts and otcs-bridge.ts.
 *
 * Supports: plain text, PDF, Word (.docx/.doc), TIFF/TIF (OCR via native tesseract CLI).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const mammoth = require('mammoth');

const MAX_TEXT_LENGTH = 100_000; // ~100k chars to keep context manageable

const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/csv',
  'text/html',
  'text/xml',
  'text/markdown',
  'application/json',
  'application/xml',
  'application/javascript',
  'application/x-yaml',
  'text/yaml',
]);

/**
 * Extract readable text from a document buffer.
 * Returns null if the format is unsupported.
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<{ text: string; method: string } | null> {
  try {
    // Plain text formats — decode directly
    if (TEXT_MIME_TYPES.has(mimeType) || mimeType.startsWith('text/')) {
      const text = buffer.toString('utf-8').slice(0, MAX_TEXT_LENGTH);
      return { text, method: 'direct' };
    }

    // PDF
    if (mimeType === 'application/pdf') {
      const result = await pdfParse(buffer);
      return { text: result.text.slice(0, MAX_TEXT_LENGTH), method: 'pdf-parse' };
    }

    // Word .docx
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value.slice(0, MAX_TEXT_LENGTH), method: 'mammoth' };
    }

    // Legacy .doc — mammoth can sometimes handle these too
    if (mimeType === 'application/msword' || fileName.endsWith('.doc')) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        if (result.value.length > 0) {
          return { text: result.value.slice(0, MAX_TEXT_LENGTH), method: 'mammoth' };
        }
      } catch {
        // Fall through — .doc not always supported
      }
    }

    // TIFF / TIF images — OCR via native tesseract CLI
    if (mimeType === 'image/tiff' || fileName.endsWith('.tif') || fileName.endsWith('.tiff')) {
      const tmpFile = path.join(os.tmpdir(), `ocr-${Date.now()}.tif`);
      try {
        fs.writeFileSync(tmpFile, buffer);
        // tesseract <input> stdout  →  prints OCR text to stdout
        const { stdout } = await execFileAsync('tesseract', [tmpFile, 'stdout'], {
          timeout: 120_000,
        });
        const text = stdout.trim();
        if (text.length > 0) {
          return { text: text.slice(0, MAX_TEXT_LENGTH), method: 'tesseract-ocr' };
        }
        return { text: '[OCR completed but no text detected in image]', method: 'tesseract-ocr' };
      } finally {
        try {
          fs.unlinkSync(tmpFile);
        } catch {
          /* ignore cleanup errors */
        }
      }
    }
  } catch (err: any) {
    return { text: `[Text extraction failed: ${err.message}]`, method: 'error' };
  }

  return null; // Unsupported format
}
