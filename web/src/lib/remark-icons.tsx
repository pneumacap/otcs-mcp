import type { Root, PhrasingContent, Text } from 'mdast';
import type { Plugin } from 'unified';

// ---------------------------------------------------------------------------
// Icon SVG map — 19 monochrome icons sized to 1em
// Each entry: [viewBox, pathData, fillMode]
//   fillMode: 'fill' = use fill=currentColor, 'stroke' = use stroke only
// ---------------------------------------------------------------------------

type IconDef = [viewBox: string, pathData: string, mode: 'fill' | 'stroke'];

const ICON_MAP: Record<string, IconDef> = {
  check: [
    '0 0 24 24',
    'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
    'fill',
  ],
  error: [
    '0 0 24 24',
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
    'fill',
  ],
  warning: [
    '0 0 24 24',
    'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
    'fill',
  ],
  pending: [
    '0 0 24 24',
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
    'fill',
  ],
  doc: [
    '0 0 24 24',
    'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z',
    'fill',
  ],
  folder: [
    '0 0 24 24',
    'M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
    'fill',
  ],
  search: [
    '0 0 24 24',
    'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
    'fill',
  ],
  upload: [
    '0 0 24 24',
    'M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z',
    'fill',
  ],
  download: [
    '0 0 24 24',
    'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
    'fill',
  ],
  workflow: [
    '0 0 24 24',
    'M14 4l2.29 2.29-2.88 2.88 1.42 1.42 2.88-2.88L20 10V4h-6zm-4 0H4v6l2.29-2.29 4.71 4.7V20h2v-8.41l-5.29-5.3L10 4z',
    'fill',
  ],
  user: [
    '0 0 24 24',
    'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    'fill',
  ],
  lock: [
    '0 0 24 24',
    'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z',
    'fill',
  ],
  link: [
    '0 0 24 24',
    'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
    'fill',
  ],
  info: [
    '0 0 24 24',
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
    'fill',
  ],
  arrow: [
    '0 0 24 24',
    'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z',
    'fill',
  ],
  workspace: [
    '0 0 24 24',
    'M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z',
    'fill',
  ],
  share: [
    '0 0 24 24',
    'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z',
    'fill',
  ],
  hold: [
    '0 0 24 24',
    'M1 21h12v2H1v-2zM5.245 8.07l2.83-2.827 14.14 14.142-2.828 2.828L5.245 8.07zM12.317 1l5.657 5.656-2.83 2.83-5.654-5.66L12.317 1zM3.825 9.485l5.657 5.657-2.828 2.828L1 12.313l2.825-2.828z',
    'fill',
  ],
  task: [
    '0 0 24 24',
    'M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z',
    'fill',
  ],
};

// ---------------------------------------------------------------------------
// Remark plugin — transforms ::token:: in text nodes into custom hast elements
// ---------------------------------------------------------------------------

const TOKEN_RE = /::([a-z_]+)::/g;

/**
 * Walk mdast tree, skip code/inlineCode, split text nodes on ::token:: matches.
 */
export const remarkIcons: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree);
  };
};

type MdastNode = Root | PhrasingContent | { type: string; children?: MdastNode[]; value?: string };

function visit(node: MdastNode): void {
  if (!('children' in node) || !Array.isArray(node.children)) return;

  // Skip code blocks entirely
  if (node.type === 'code' || node.type === 'inlineCode') return;

  const children = node.children as MdastNode[];
  const next: MdastNode[] = [];
  let changed = false;

  for (const child of children) {
    if (child.type === 'text' && typeof child.value === 'string') {
      const parts = splitTextNode(child.value);
      if (parts.length === 1 && parts[0].type === 'text') {
        next.push(child);
      } else {
        next.push(...parts);
        changed = true;
      }
    } else {
      // Recurse into non-text children (but not code)
      if (child.type !== 'code' && child.type !== 'inlineCode') {
        visit(child);
      }
      next.push(child);
    }
  }

  if (changed) {
    (node as { children: MdastNode[] }).children = next;
  }
}

function splitTextNode(value: string): MdastNode[] {
  const parts: MdastNode[] = [];
  let lastIndex = 0;

  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_RE.exec(value)) !== null) {
    const tokenName = match[1];
    if (!(tokenName in ICON_MAP)) continue; // unknown token — leave as text

    // Text before the match
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: value.slice(lastIndex, match.index) } as Text);
    }

    // Icon node — uses hProperties for rehype/react-markdown
    parts.push({
      type: 'element' as never,
      data: {
        hName: 'icon-inline',
        hProperties: { name: tokenName },
      },
      children: [],
    } as unknown as MdastNode);

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex === 0) {
    return [{ type: 'text', value } as Text];
  }
  if (lastIndex < value.length) {
    parts.push({ type: 'text', value: value.slice(lastIndex) } as Text);
  }

  return parts;
}

// ---------------------------------------------------------------------------
// InlineIcon React component — renders SVG inline at 1em
// ---------------------------------------------------------------------------

interface InlineIconProps {
  name?: string;
  node?: unknown;
}

export function InlineIcon({ name }: InlineIconProps) {
  if (!name || !(name in ICON_MAP)) return null;
  const [viewBox, pathData, mode] = ICON_MAP[name];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      className="inline-block h-[1em] w-[1em] align-[-0.125em]"
      fill={mode === 'fill' ? 'currentColor' : 'none'}
      stroke={mode === 'stroke' ? 'currentColor' : undefined}
      strokeWidth={mode === 'stroke' ? 2 : undefined}
      aria-hidden="true"
    >
      <path d={pathData} />
    </svg>
  );
}
