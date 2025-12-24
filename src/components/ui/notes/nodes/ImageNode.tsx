import type { DOMExportOutput, ElementFormatType, LexicalNode, NodeKey, SerializedLexicalNode } from 'lexical';
import { $applyNodeReplacement, $getNodeByKey, createCommand, CLICK_COMMAND, COMMAND_PRIORITY_LOW } from 'lexical';
import * as React from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode';
import { $insertNodeToNearestRoot, mergeRegister } from '@lexical/utils';

export type SerializedImageNode = SerializedLexicalNode & {
  type: 'image';
  version: 1;
  src: string;
  altText: string;
  width?: number;
  format: ElementFormatType;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const ImageComponent = ({ nodeKey, src, altText, width }: { nodeKey: NodeKey; src: string; altText: string; width?: number }) => {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const ref = React.useRef<HTMLDivElement | null>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const [isResizing, setIsResizing] = React.useState(false);

  React.useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          const target = event.target as Node | null;
          if (!target) return false;
          if (imgRef.current && (target === imgRef.current || imgRef.current.contains(target))) {
            if (!event.shiftKey) clearSelection();
            setSelected(true);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      )
    );
  }, [clearSelection, editor, setSelected]);

  const beginResize = (corner: 'se' | 'sw' | 'ne' | 'nw') => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!imgRef.current) return;
    setIsResizing(true);
    const startX = e.clientX;
    const rect = imgRef.current.getBoundingClientRect();
    const startW = rect.width;
    const startH = rect.height;
    const aspect = startW > 0 ? startH / startW : 1;
    const sign = corner === 'se' || corner === 'ne' ? 1 : -1;
    let nextW = startW;

    const onMove = (ev: PointerEvent) => {
      ev.preventDefault();
      const dx = (ev.clientX - startX) * sign;
      nextW = clamp(startW + dx, 32, 1200);
      const el = imgRef.current;
      if (!el) return;
      el.style.width = `${Math.round(nextW)}px`;
      el.style.height = `${Math.round(nextW * aspect)}px`;
      el.style.maxWidth = 'none';
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setIsResizing(false);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isImageNode(node)) {
          node.setWidth(Math.round(nextW));
        }
      });
      try {
        if (imgRef.current) {
          imgRef.current.style.height = 'auto';
          imgRef.current.style.maxWidth = '100%';
        }
      } catch {}
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { passive: false, once: true });
  };

  const border = isSelected ? 'ring-2 ring-primary/50' : 'ring-1 ring-slate-200/70';

  return (
    <div
      ref={ref}
      className="relative inline-block max-w-full"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        // Ensure selection works even if Lexical's CLICK_COMMAND doesn't fire on non-editable decorator DOM.
        e.stopPropagation();
        if (!e.shiftKey) clearSelection();
        setSelected(true);
      }}
    >
      <img
        ref={imgRef}
        src={src}
        alt={altText}
        style={{ width: width ? `${width}px` : undefined, height: 'auto', maxWidth: '100%', borderRadius: 10 }}
        className={`${border} block`}
        draggable={false}
      />
      {isSelected ? (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-[10px] ring-2 ring-primary/25" />
          {editor.isEditable() && !isResizing ? (
            <>
              <div
                className="absolute -left-2 -top-2 h-4 w-4 cursor-nwse-resize rounded-full border border-white bg-primary shadow"
                onPointerDown={beginResize('nw')}
              />
              <div
                className="absolute -right-2 -top-2 h-4 w-4 cursor-nesw-resize rounded-full border border-white bg-primary shadow"
                onPointerDown={beginResize('ne')}
              />
              <div
                className="absolute -left-2 -bottom-2 h-4 w-4 cursor-nesw-resize rounded-full border border-white bg-primary shadow"
                onPointerDown={beginResize('sw')}
              />
              <div
                className="absolute -right-2 -bottom-2 h-4 w-4 cursor-nwse-resize rounded-full border border-white bg-primary shadow"
                onPointerDown={beginResize('se')}
              />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export class ImageNode extends DecoratorBlockNode {
  __src: string;
  __altText: string;
  __width?: number;

  static getType(): string {
    return 'image';
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__altText, node.__width, node.__format, node.__key);
  }

  static importDOM() {
    return {
      img: (domNode: Node) => {
        const element = domNode as HTMLImageElement;
        const src = element.getAttribute('src') || '';
        if (!src) return null;
        return {
          conversion: () => {
            const alt = element.getAttribute('alt') || '';
            const widthAttr = element.getAttribute('width');
            let width = widthAttr ? Number(widthAttr) : undefined;
            if (!width || Number.isNaN(width)) {
              const styleW = element.style?.width || '';
              const m = styleW.match(/^(\d+(?:\.\d+)?)px$/);
              if (m) width = Math.round(Number(m[1]));
            }
            return { node: $createImageNode(src, alt, width) } as any;
          },
          priority: 2 as 2
        };
      }
    };
  }

  constructor(src: string, altText: string, width?: number, format: ElementFormatType = '', key?: NodeKey) {
    super(format, key);
    this.__src = src;
    this.__altText = altText;
    this.__width = width;
  }

  setWidth(width?: number) {
    const writable = this.getWritable();
    (writable as any).__width = width;
  }

  static importJSON(serialized: SerializedImageNode): ImageNode {
    const node = new ImageNode(serialized.src, serialized.altText, serialized.width, (serialized as any).format || '');
    return node.updateFromJSON(serialized as any) as any;
  }

  exportJSON(): SerializedImageNode {
    return {
      ...(super.exportJSON() as any),
      type: 'image',
      version: 1,
      src: this.__src,
      altText: this.__altText,
      width: this.__width
    } as any;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('img');
    element.setAttribute('src', this.__src);
    element.setAttribute('alt', this.__altText || '');
    if (this.__width) element.setAttribute('width', String(this.__width));
    element.style.maxWidth = '100%';
    element.style.height = 'auto';
    element.style.borderRadius = '10px';
    return { element };
  }

  createDOM(): HTMLElement {
    const el = super.createDOM();
    el.style.maxWidth = '100%';
    el.contentEditable = 'false';
    return el;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return <ImageComponent nodeKey={this.getKey()} src={this.__src} altText={this.__altText} width={this.__width} />;
  }
}

export const $createImageNode = (src: string, altText = '', width?: number) =>
  $applyNodeReplacement(new ImageNode(src, altText, width));
export const $isImageNode = (node: LexicalNode | null | undefined): node is ImageNode => node instanceof ImageNode;

export const INSERT_IMAGE_COMMAND = createCommand<{ src: string; altText?: string; width?: number }>('INSERT_IMAGE_COMMAND');

export const registerImageInsertCommand = (editor: any) => {
  return editor.registerCommand(
    INSERT_IMAGE_COMMAND,
    (payload: { src: string; altText?: string; width?: number }) => {
      editor.update(() => {
        const node = $createImageNode(payload.src, payload.altText || '', payload.width);
        $insertNodeToNearestRoot(node);
      });
      return true;
    },
    COMMAND_PRIORITY_LOW
  );
};
