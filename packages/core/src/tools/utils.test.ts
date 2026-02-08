import { describe, it, expect } from 'vitest';
import { getMimeType, getSuggestion, compactToolResult, pickKeys } from './utils';

describe('getMimeType', () => {
  it('returns correct MIME for known extensions', () => {
    expect(getMimeType('file.pdf')).toBe('application/pdf');
    expect(getMimeType('doc.docx')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(getMimeType('image.png')).toBe('image/png');
    expect(getMimeType('data.json')).toBe('application/json');
    expect(getMimeType('page.html')).toBe('text/html');
  });

  it('returns octet-stream for unknown extensions', () => {
    expect(getMimeType('file.xyz')).toBe('application/octet-stream');
    expect(getMimeType('noext')).toBe('application/octet-stream');
  });

  it('handles case insensitivity via path.extname', () => {
    expect(getMimeType('FILE.PDF')).toBe('application/pdf');
  });
});

describe('getSuggestion', () => {
  it('suggests re-auth for 401', () => {
    expect(getSuggestion('Error 401 Unauthorized')).toContain('re-authenticating');
  });

  it('suggests node moved for 404', () => {
    expect(getSuggestion('Node not found')).toContain('deleted or moved');
  });

  it('suggests permissions for 403', () => {
    expect(getSuggestion('403 Forbidden permission denied')).toContain('permissions');
  });

  it('returns generic suggestion for unknown errors', () => {
    expect(getSuggestion('Something went wrong')).toContain('Check the error');
  });
});

describe('pickKeys', () => {
  it('picks only specified keys', () => {
    const obj = { id: 1, name: 'test', type: 2, extra: 'x' };
    const result = pickKeys(obj, new Set(['id', 'name']));
    expect(result).toEqual({ id: 1, name: 'test' });
  });

  it('ignores missing keys', () => {
    const obj = { id: 1 };
    const result = pickKeys(obj, new Set(['id', 'name']));
    expect(result).toEqual({ id: 1 });
  });
});

describe('compactToolResult', () => {
  it('compacts browse results', () => {
    const result = {
      items: [{ id: 1, name: 'a', type: 0, type_name: 'Folder', container_size: 5, extra: 'x' }],
      folder: { id: 0 },
    };
    const compacted = JSON.parse(compactToolResult('otcs_browse', result));
    expect(compacted.items[0]).not.toHaveProperty('extra');
    expect(compacted.items[0]).toHaveProperty('id');
  });

  it('compacts search results', () => {
    const result = {
      total_count: 1,
      results: [{ id: 1, name: 'a', type: 144, type_name: 'Document', extra: 'x' }],
    };
    const compacted = JSON.parse(compactToolResult('otcs_search', result));
    expect(compacted.results[0]).not.toHaveProperty('extra');
    expect(compacted.total_count).toBe(1);
  });

  it('passes through other tools unchanged', () => {
    const result = { data: 'test' };
    expect(compactToolResult('otcs_get_node', result)).toBe(JSON.stringify(result));
  });
});
