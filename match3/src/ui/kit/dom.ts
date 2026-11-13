/**
 * Tiny DOM helpers of the UI kit: a hyperscript-style element builder and friends.
 * No framework, no virtual DOM — these create real nodes.
 */

/** Anything `el()` accepts as a child. Strings and numbers become text nodes; null / false are skipped. */
export type Child = Node | string | number | null | undefined | false | readonly Child[];

/**
 * Properties for `el()`:
 *  - `class` (or `className`): class attribute
 *  - `text`: textContent (set before children are appended)
 *  - `style`: a CSS string, or an object (`{ marginTop: '4px', '--k-p': '0.5' }`)
 *  - `dataset`: `{ shot: 'buttons' }` → data-shot="buttons"
 *  - `on<event>` functions (`onclick`, `onpointerdown` …): addEventListener
 *  - names containing "-" (`aria-label`, `data-x`) and `role`: attributes
 *  - anything else: a DOM property when the element has it (`id`, `type`, `disabled`, `tabIndex`),
 *    otherwise an attribute
 *  null / undefined / false values are skipped.
 */
export interface ElProps {
  class?: string | null | false;
  className?: string | null | false;
  text?: string | number | null;
  style?: string | Record<string, string | number | null | undefined> | null;
  dataset?: Record<string, string | number | null | undefined> | null;
  [name: string]: unknown;
}

function isChild(value: unknown): value is Child {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    Array.isArray(value) ||
    (typeof Node !== 'undefined' && value instanceof Node)
  );
}

function append(parent: Node, child: Child): void {
  if (child === null || child === undefined || child === false) return;
  if (typeof child === 'string' || typeof child === 'number') {
    parent.appendChild(document.createTextNode(String(child)));
  } else if (Array.isArray(child)) {
    for (let i = 0; i < child.length; i++) append(parent, child[i] as Child);
  } else {
    parent.appendChild(child as Node);
  }
}

function applyStyle(node: HTMLElement, style: NonNullable<ElProps['style']>): void {
  if (typeof style === 'string') {
    node.style.cssText = style;
    return;
  }
  for (const name of Object.keys(style)) {
    const value = style[name];
    if (value === null || value === undefined) continue;
    if (name.indexOf('-') >= 0) node.style.setProperty(name, String(value));
    else (node.style as unknown as Record<string, string>)[name] = String(value);
  }
}

/**
 * Create an element: `el('div', { class: 'row', onclick: fn }, child, 'text', [more])`.
 * The props object is optional — `el('span', 'hello')` works too.
 */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props?: ElProps | Child, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (isChild(props) || props === null || props === undefined || props === false) {
    append(node, props as Child);
  } else {
    const p = props as ElProps;
    for (const name of Object.keys(p)) {
      const value = p[name];
      if (value === null || value === undefined || value === false) continue;
      if (name === 'class' || name === 'className') {
        node.className = String(value);
      } else if (name === 'text') {
        node.textContent = String(value);
      } else if (name === 'style') {
        applyStyle(node, value as NonNullable<ElProps['style']>);
      } else if (name === 'dataset') {
        const data = value as Record<string, string | number | null | undefined>;
        for (const key of Object.keys(data)) {
          const v = data[key];
          if (v !== null && v !== undefined) node.dataset[key] = String(v);
        }
      } else if (name.length > 2 && name.charAt(0) === 'o' && name.charAt(1) === 'n' && typeof value === 'function') {
        node.addEventListener(name.slice(2).toLowerCase(), value as EventListener);
      } else if (name === 'role' || name.indexOf('-') >= 0) {
        node.setAttribute(name, value === true ? '' : String(value));
      } else if (name in node) {
        (node as unknown as Record<string, unknown>)[name] = value;
      } else {
        node.setAttribute(name, value === true ? '' : String(value));
      }
    }
  }
  for (let i = 0; i < children.length; i++) append(node, children[i] as Child);
  return node;
}

/** Remove every child of a node. Returns the node. */
export function clear<T extends Node>(node: T): T {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Force a style flush so a class added right afterwards starts its transition / animation. */
export function reflow(node: HTMLElement): void {
  void node.offsetWidth;
}

/** Restart a one-shot CSS animation that is driven by a class. */
export function replay(node: HTMLElement, className: string): void {
  node.classList.remove(className);
  reflow(node);
  node.classList.add(className);
}

/** Detach a node from its parent (no-op when it has none). */
export function detach(node: Node): void {
  const parent = node.parentNode;
  if (parent) parent.removeChild(node);
}
