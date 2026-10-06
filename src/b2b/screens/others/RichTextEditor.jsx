import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

// The template editor's "Email body" field (production: react-quill, snow theme,
// with the toolbar from AutoResponseEmailEditor's QUILL_MODULES):
//   [header] [color, background] [align] [bold, italic, underline, strike]
//   [ordered, bullet] [indent -1, +1] [link] [clean]
// Rebuilt as a contentEditable surface with the snow toolbar's look; `onChange`
// receives the HTML after each user edit (Quill only reports "user" changes).

const QUILL_COLORS = [
  '#000000', '#e60000', '#ff9900', '#ffff00', '#008a00', '#0066cc', '#9933ff',
  '#ffffff', '#facccc', '#ffebcc', '#ffffcc', '#cce8cc', '#cce0f5', '#ebd6ff',
  '#bbbbbb', '#f06666', '#ffc266', '#ffff66', '#66b966', '#66a3e0', '#c285ff',
  '#888888', '#a10000', '#b26b00', '#b2b200', '#006100', '#0047b2', '#6b24b2',
  '#444444', '#5c0000', '#663d14', '#666600', '#003700', '#002966', '#3d1466',
];

const HEADER_OPTIONS = [
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'p', label: 'Normal' },
];

const ALIGN_OPTIONS = [
  { value: 'left', command: 'justifyLeft' },
  { value: 'center', command: 'justifyCenter' },
  { value: 'right', command: 'justifyRight' },
  { value: 'justify', command: 'justifyFull' },
];

const BLOCK_TAGS = ['P', 'H1', 'H2', 'H3', 'LI', 'DIV'];
const MAX_INDENT = 8;

// Quill snow icons (18×18, stroke #444).
const S = { className: 'oth-ql-stroke' };
const F = { className: 'oth-ql-fill' };
const ICONS = {
  bold: (
    <>
      <path {...S} d="M5,4H9.5A2.5,2.5,0,0,1,12,6.5v0A2.5,2.5,0,0,1,9.5,9H5A0,0,0,0,1,5,9V4A0,0,0,0,1,5,4Z" />
      <path {...S} d="M5,9h5.5A2.5,2.5,0,0,1,13,11.5v0A2.5,2.5,0,0,1,10.5,14H5a0,0,0,0,1,0,0V9A0,0,0,0,1,5,9Z" />
    </>
  ),
  italic: (
    <>
      <line {...S} x1="7" x2="13" y1="4" y2="4" />
      <line {...S} x1="5" x2="11" y1="14" y2="14" />
      <line {...S} x1="8" x2="10" y1="14" y2="4" />
    </>
  ),
  underline: (
    <>
      <path {...S} d="M5,3V9a4.012,4.012,0,0,0,4,4H9a4.012,4.012,0,0,0,4-4V3" />
      <rect {...F} height="1" rx="0.5" ry="0.5" width="12" x="3" y="15" />
    </>
  ),
  strike: (
    <>
      <line className="oth-ql-stroke oth-ql-thin" x1="15.5" x2="2.5" y1="8.5" y2="9.5" />
      <path {...F} d="M9.007,8C6.542,7.791,6,7.519,6,6.5,6,5.792,7.283,5,9,5c1.571,0,2.765.679,2.969,1.309a1,1,0,0,0,1.9-.617C13.356,4.106,11.354,3,9,3,6.2,3,4,4.538,4,6.5a3.2,3.2,0,0,0,.5,1.843Z" />
      <path {...F} d="M8.984,10C11.457,10.208,12,10.479,12,11.5c0,0.708-1.283,1.5-3,1.5-1.571,0-2.765-.679-2.969-1.309a1,1,0,1,0-1.9.617C4.644,13.894,6.646,15,9,15c2.8,0,5-1.538,5-3.5a3.2,3.2,0,0,0-.5-1.843Z" />
    </>
  ),
  ordered: (
    <>
      <line {...S} x1="7" x2="15" y1="4" y2="4" />
      <line {...S} x1="7" x2="15" y1="9" y2="9" />
      <line {...S} x1="7" x2="15" y1="14" y2="14" />
      <line className="oth-ql-stroke oth-ql-thin" x1="2.5" x2="4.5" y1="5.5" y2="5.5" />
      <path {...F} d="M3.5,6A0.5,0.5,0,0,1,3,5.5V3.085l-0.276.138A0.5,0.5,0,0,1,2.053,3c-0.124-.247-0.023-0.324.224-0.447l1-.5A0.5,0.5,0,0,1,4,2.5v3A0.5,0.5,0,0,1,3.5,6Z" />
      <path className="oth-ql-stroke oth-ql-thin" d="M4.5,10.5h-2c0-.234,1.85-1.076,1.85-2.234A0.959,0.959,0,0,0,2.5,8.156" />
      <path className="oth-ql-stroke oth-ql-thin" d="M2.5,14.846a0.959,0.959,0,0,0,1.85-.109A0.7,0.7,0,0,0,3.75,14a0.688,0.688,0,0,0,.6-0.736,0.959,0.959,0,0,0-1.85-.109" />
    </>
  ),
  bullet: (
    <>
      <line {...S} x1="6" x2="15" y1="4" y2="4" />
      <line {...S} x1="6" x2="15" y1="9" y2="9" />
      <line {...S} x1="6" x2="15" y1="14" y2="14" />
      <line {...S} x1="3" x2="3" y1="4" y2="4" />
      <line {...S} x1="3" x2="3" y1="9" y2="9" />
      <line {...S} x1="3" x2="3" y1="14" y2="14" />
    </>
  ),
  outdent: (
    <>
      <line {...S} x1="3" x2="15" y1="14" y2="14" />
      <line {...S} x1="3" x2="15" y1="4" y2="4" />
      <line {...S} x1="9" x2="15" y1="9" y2="9" />
      <polyline {...S} points="5 7 5 11 3 9 5 7" />
    </>
  ),
  indent: (
    <>
      <line {...S} x1="3" x2="15" y1="14" y2="14" />
      <line {...S} x1="3" x2="15" y1="4" y2="4" />
      <line {...S} x1="9" x2="15" y1="9" y2="9" />
      <polyline className="oth-ql-fill oth-ql-stroke" points="3 7 3 11 5 9 3 7" />
    </>
  ),
  link: (
    <>
      <line {...S} x1="7" x2="11" y1="7" y2="11" />
      <path {...S} d="M8.9,4.577a3.476,3.476,0,0,1,.36,4.679A3.476,3.476,0,0,1,4.577,8.9C3.185,7.5,2.035,6.4,4.217,4.217S7.5,3.185,8.9,4.577Z" />
      <path {...S} d="M13.423,9.1a3.476,3.476,0,0,0-4.679-.36,3.476,3.476,0,0,0,.36,4.679c1.392,1.392,2.5,2.542,4.679.36S14.815,10.5,13.423,9.1Z" />
    </>
  ),
  clean: (
    <>
      <line {...S} x1="5" x2="13" y1="3" y2="3" />
      <line {...S} x1="6" x2="9.35" y1="12" y2="3" />
      <line {...S} x1="11" x2="15" y1="11" y2="15" />
      <line {...S} x1="15" x2="11" y1="11" y2="15" />
      <rect {...F} height="1" rx="0.5" ry="0.5" width="7" x="2" y="14" />
    </>
  ),
  color: (
    <>
      <line className="oth-ql-stroke oth-ql-color-label" x1="3" x2="15" y1="15" y2="15" />
      <polyline {...S} points="5.5 11 9 3 12.5 11" />
      <line {...S} x1="11.63" x2="6.38" y1="9" y2="9" />
    </>
  ),
  background: (
    <>
      <g className="oth-ql-fill oth-ql-checker">
        {[
          [2, 3], [3, 2], [6, 2], [9, 2], [12, 2], [15, 2], [5, 3], [11, 3], [14, 3], [4, 4], [13, 4], [3, 5],
          [12, 5], [15, 5], [2, 6], [14, 6], [4, 7], [13, 7], [3, 8], [15, 8], [2, 9], [14, 9], [2, 12], [15, 11],
          [2, 15], [5, 15], [8, 15], [11, 15], [14, 15], [9, 14], [15, 14],
        ].map(([x, y]) => (
          <rect key={`${x}-${y}`} height="1" width="1" x={x} y={y} />
        ))}
      </g>
      <polyline {...S} points="5.5 13 9 5 12.5 13" />
      <line {...S} x1="11.63" x2="6.38" y1="11" y2="11" />
    </>
  ),
  left: (
    <>
      <line {...S} x1="3" x2="15" y1="9" y2="9" />
      <line {...S} x1="3" x2="13" y1="14" y2="14" />
      <line {...S} x1="3" x2="9" y1="4" y2="4" />
    </>
  ),
  center: (
    <>
      <line {...S} x1="15" x2="3" y1="9" y2="9" />
      <line {...S} x1="14" x2="4" y1="14" y2="14" />
      <line {...S} x1="12" x2="6" y1="4" y2="4" />
    </>
  ),
  right: (
    <>
      <line {...S} x1="15" x2="3" y1="9" y2="9" />
      <line {...S} x1="15" x2="5" y1="14" y2="14" />
      <line {...S} x1="15" x2="9" y1="4" y2="4" />
    </>
  ),
  justify: (
    <>
      <line {...S} x1="15" x2="3" y1="9" y2="9" />
      <line {...S} x1="15" x2="3" y1="14" y2="14" />
      <line {...S} x1="15" x2="3" y1="4" y2="4" />
    </>
  ),
  dropdown: (
    <>
      <polygon {...S} points="7 11 9 13 11 11 7 11" />
      <polygon {...S} points="7 7 9 5 11 7 7 7" />
    </>
  ),
};

const Svg = ({ name }) => (
  <svg viewBox="0 0 18 18" aria-hidden="true">
    {ICONS[name]}
  </svg>
);

// Keep the editor's selection while using the toolbar.
const keepSelection = (e) => e.preventDefault();

function ToolbarButton({ name, label, active, onClick }) {
  return (
    <button
      type="button"
      className={`oth-ql-button${active ? ' oth-ql-active' : ''}`}
      aria-label={label}
      aria-pressed={active ? 'true' : undefined}
      onMouseDown={keepSelection}
      onClick={onClick}
    >
      <Svg name={name} />
    </button>
  );
}

export function RichTextEditor({ value, onChange, readOnly = false, ariaLabel = 'Email body' }) {
  const editorRef = useRef(null);
  const rootRef = useRef(null);
  const savedRange = useRef(null);
  const [openPicker, setOpenPicker] = useState(null); // 'header' | 'color' | 'background' | 'align'
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [formats, setFormats] = useState({});

  // Show `value` unless it is what the editor already holds (a user edit).
  useLayoutEffect(() => {
    const el = editorRef.current;
    if (el && el.innerHTML !== value) el.innerHTML = value || '';
  }, [value]);

  const emit = () => {
    const el = editorRef.current;
    if (el) onChange?.(el.innerHTML);
  };

  const currentBlock = () => {
    const sel = window.getSelection();
    const el = editorRef.current;
    if (!sel || !sel.rangeCount || !el) return null;
    let node = sel.getRangeAt(0).startContainer;
    if (!el.contains(node)) return null;
    while (node && node !== el) {
      if (node.nodeType === 1 && BLOCK_TAGS.includes(node.tagName)) return node;
      node = node.parentNode;
    }
    return null;
  };

  const refreshFormats = () => {
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return;
    const q = (cmd) => {
      try {
        return document.queryCommandState(cmd);
      } catch {
        return false;
      }
    };
    const block = currentBlock();
    const tag = block?.tagName === 'LI' ? 'p' : (block?.tagName || 'P').toLowerCase();
    const align = block ? getComputedStyle(block).textAlign : 'left';
    setFormats({
      bold: q('bold'),
      italic: q('italic'),
      underline: q('underline'),
      strike: q('strikeThrough'),
      ordered: q('insertOrderedList'),
      bullet: q('insertUnorderedList'),
      link: !!sel.anchorNode?.parentElement?.closest('a'),
      header: ['h1', 'h2', 'h3'].includes(tag) ? tag : 'p',
      align: ['center', 'right', 'justify'].includes(align) ? align : 'left',
    });
  };

  useEffect(() => {
    document.addEventListener('selectionchange', refreshFormats);
    return () => document.removeEventListener('selectionchange', refreshFormats);
  });

  // Close an open picker on an outside click.
  useEffect(() => {
    if (!openPicker) return undefined;
    const onDown = (e) => {
      if (!rootRef.current?.querySelector('.oth-ql-toolbar')?.contains(e.target)) setOpenPicker(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openPicker]);

  const exec = (command, arg) => {
    if (readOnly) return;
    editorRef.current?.focus();
    document.execCommand('styleWithCSS', false, command === 'foreColor' || command === 'hiliteColor');
    document.execCommand(command, false, arg);
    emit();
    refreshFormats();
  };

  // Quill indents a line with .ql-indent-N (3em steps) instead of a blockquote.
  const indent = (delta) => {
    if (readOnly) return;
    const block = currentBlock();
    if (!block) return;
    const level = Math.min(MAX_INDENT, Math.max(0, Number(block.dataset.indent || 0) + delta));
    if (level) {
      block.dataset.indent = String(level);
      block.style.paddingLeft = `${level * 3}em`;
    } else {
      delete block.dataset.indent;
      block.style.removeProperty('padding-left');
    }
    emit();
  };

  const openLink = () => {
    const sel = window.getSelection();
    if (readOnly || !sel || !sel.rangeCount || sel.isCollapsed || !editorRef.current?.contains(sel.anchorNode)) return;
    savedRange.current = sel.getRangeAt(0).cloneRange();
    setLinkValue('');
    setLinkOpen(true);
  };

  const saveLink = () => {
    const url = linkValue.trim();
    setLinkOpen(false);
    if (!url || !savedRange.current) return;
    editorRef.current?.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange.current);
    exec('createLink', url);
  };

  const headerLabel = HEADER_OPTIONS.find((o) => o.value === (formats.header || 'p'))?.label;

  const picker = (id, labelNode, options, extraClass = '') => (
    <span className={`oth-ql-picker ${extraClass}${openPicker === id ? ' oth-ql-expanded' : ''}`}>
      <button
        type="button"
        className="oth-ql-picker-label"
        aria-haspopup="listbox"
        aria-expanded={openPicker === id}
        aria-label={id === 'header' ? 'Text style' : id === 'align' ? 'Alignment' : id === 'color' ? 'Text color' : 'Background color'}
        onMouseDown={keepSelection}
        onClick={() => setOpenPicker((cur) => (cur === id ? null : id))}
      >
        {labelNode}
      </button>
      {openPicker === id ? <span className="oth-ql-picker-options">{options}</span> : null}
    </span>
  );

  const colorOptions = (command) =>
    QUILL_COLORS.map((c) => (
      <button
        key={c}
        type="button"
        className="oth-ql-swatch"
        aria-label={c}
        onMouseDown={keepSelection}
        onClick={() => {
          setOpenPicker(null);
          exec(command, c);
        }}
      >
        <span style={{ background: c }} />
      </button>
    ));

  return (
    <div ref={rootRef} className="oth-ql">
      <div className="oth-ql-toolbar" role="toolbar" aria-label="Formatting">
        <span className="oth-ql-formats">
          {picker(
            'header',
            <>
              <span className="oth-ql-picker-text">{headerLabel}</span>
              <Svg name="dropdown" />
            </>,
            HEADER_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`oth-ql-picker-item oth-ql-picker-item--${o.value}${(formats.header || 'p') === o.value ? ' oth-ql-selected' : ''}`}
                onMouseDown={keepSelection}
                onClick={() => {
                  setOpenPicker(null);
                  exec('formatBlock', o.value);
                }}
              >
                {o.label}
              </button>
            )),
            'oth-ql-header',
          )}
        </span>
        <span className="oth-ql-formats">
          {picker('color', <Svg name="color" />, colorOptions('foreColor'), 'oth-ql-color-picker')}
          {picker('background', <Svg name="background" />, colorOptions('hiliteColor'), 'oth-ql-color-picker')}
        </span>
        <span className="oth-ql-formats">
          {picker(
            'align',
            <Svg name={formats.align || 'left'} />,
            ALIGN_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`oth-ql-picker-item oth-ql-icon-item${(formats.align || 'left') === o.value ? ' oth-ql-selected' : ''}`}
                aria-label={`Align ${o.value}`}
                onMouseDown={keepSelection}
                onClick={() => {
                  setOpenPicker(null);
                  exec(o.command);
                }}
              >
                <Svg name={o.value} />
              </button>
            )),
            'oth-ql-icon-picker',
          )}
        </span>
        <span className="oth-ql-formats">
          <ToolbarButton name="bold" label="Bold" active={formats.bold} onClick={() => exec('bold')} />
          <ToolbarButton name="italic" label="Italic" active={formats.italic} onClick={() => exec('italic')} />
          <ToolbarButton name="underline" label="Underline" active={formats.underline} onClick={() => exec('underline')} />
          <ToolbarButton name="strike" label="Strike" active={formats.strike} onClick={() => exec('strikeThrough')} />
        </span>
        <span className="oth-ql-formats">
          <ToolbarButton name="ordered" label="Ordered list" active={formats.ordered} onClick={() => exec('insertOrderedList')} />
          <ToolbarButton name="bullet" label="Bullet list" active={formats.bullet} onClick={() => exec('insertUnorderedList')} />
        </span>
        <span className="oth-ql-formats">
          <ToolbarButton name="outdent" label="Decrease indent" onClick={() => indent(-1)} />
          <ToolbarButton name="indent" label="Increase indent" onClick={() => indent(1)} />
        </span>
        <span className="oth-ql-formats">
          <ToolbarButton name="link" label="Link" active={formats.link} onClick={openLink} />
        </span>
        <span className="oth-ql-formats">
          <ToolbarButton
            name="clean"
            label="Remove formatting"
            onClick={() => {
              exec('removeFormat');
              exec('unlink');
            }}
          />
        </span>
      </div>
      <div className="oth-ql-container">
        <div
          ref={editorRef}
          className="oth-ql-editor"
          contentEditable={!readOnly}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          onInput={emit}
          onKeyUp={refreshFormats}
          onMouseUp={refreshFormats}
        />
        {linkOpen ? (
          // Snow theme's link tooltip ("Enter link:" + Save).
          <div className="oth-ql-tooltip">
            <span>Enter link:</span>
            <input
              type="text"
              placeholder="https://quilljs.com"
              value={linkValue}
              autoFocus
              onChange={(e) => setLinkValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveLink();
                } else if (e.key === 'Escape') {
                  setLinkOpen(false);
                }
              }}
            />
            <button type="button" className="oth-ql-tooltip-action" onClick={saveLink}>
              Save
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
