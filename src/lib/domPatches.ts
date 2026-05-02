/**
 * DOM Patches – Defensive guards for browser translation extensions.
 *
 * Why this exists
 * ---------------
 * Browser translation tools (Google Translate, Chrome auto-translate,
 * Microsoft Translator, etc.) replace text nodes in the live DOM. When React
 * later tries to update or unmount those nodes, the references it kept no
 * longer match the real parent. The result is one of these crashes:
 *
 *   NotFoundError: Failed to execute 'removeChild' on 'Node':
 *     The node to be removed is not a child of this node.
 *   NotFoundError: Failed to execute 'insertBefore' on 'Node':
 *     The node before which the new node is to be inserted is not a child...
 *
 * Strategy
 * --------
 * We monkey-patch `Node.prototype.removeChild` and `Node.prototype.insertBefore`
 * once, at app boot. If React asks the DOM to remove/insert a node whose
 * parent has changed underneath it (typical translation symptom), we silently
 * no-op instead of throwing — keeping the React tree alive.
 *
 * SOLID
 * -----
 * - Single Responsibility: this module only hardens the DOM.
 * - Open/Closed: components stay untouched; behavior is added externally.
 * - Idempotent: safe to call multiple times (HMR, tests).
 */

const PATCH_FLAG = "__influboard_dom_patched__";

export function applyDomPatches(): void {
  if (typeof window === "undefined" || typeof Node === "undefined") return;

  const proto = Node.prototype as Node & Record<string, unknown>;
  if (proto[PATCH_FLAG]) return;

  const originalRemoveChild = proto.removeChild as Node["removeChild"];
  const originalInsertBefore = proto.insertBefore as Node["insertBefore"];

  proto.removeChild = function patchedRemoveChild<T extends Node>(
    this: Node,
    child: T,
  ): T {
    if (child.parentNode !== this) {
      // Translation extension already moved/replaced this node.
      // Returning the child mirrors the spec contract without throwing.
      if (import.meta.env.DEV) {
        console.warn(
          "[domPatches] removeChild called on a non-child node – ignoring (likely translation extension).",
        );
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  } as Node["removeChild"];

  proto.insertBefore = function patchedInsertBefore<T extends Node>(
    this: Node,
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (import.meta.env.DEV) {
        console.warn(
          "[domPatches] insertBefore reference node not a child – appending instead (likely translation extension).",
        );
      }
      return this.appendChild(newNode) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  } as Node["insertBefore"];

  Object.defineProperty(proto, PATCH_FLAG, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
}
