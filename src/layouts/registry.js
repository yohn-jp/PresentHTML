import {
  createLayoutContract,
  isLayoutContract,
} from "./layout-contract.js";

function layoutKind(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.kind === "string") return value.kind;
  return undefined;
}

function asContract(value) {
  return isLayoutContract(value) ? value : createLayoutContract(value);
}

/**
 * Create an isolated layout registry.
 *
 * The registry is an adapter boundary: replacing a registered contract never
 * changes the semantic shape of a Deck or any persisted project JSON.
 */
export function createLayoutRegistry(initialLayouts = [], { defaultKind } = {}) {
  const layouts = new Map();
  const values = Array.isArray(initialLayouts) ? initialLayouts : [initialLayouts];

  function register(layout, { replace = false } = {}) {
    const contract = asContract(layout);
    if (!replace && layouts.has(contract.kind)) {
      throw new TypeError(`Layout already registered: ${contract.kind}`);
    }
    layouts.set(contract.kind, contract);
    return contract;
  }

  values.filter((value) => value !== undefined).forEach((layout) => register(layout));
  const initialDefault = defaultKind || (values[0] && layoutKind(values[0]));

  function get(ref) {
    const kind = layoutKind(ref);
    if (kind === undefined) return undefined;
    return layouts.get(kind);
  }

  function resolve(ref) {
    const contract = ref === undefined ? layouts.get(initialDefault) : get(ref);
    if (!contract) {
      const kind = layoutKind(ref);
      throw new RangeError(`Layout not found: ${kind === undefined ? "(default)" : kind}`);
    }
    return contract;
  }

  function validate(ref, content) {
    return resolve(ref).validate(content);
  }

  function unregister(ref) {
    const kind = layoutKind(ref);
    if (kind === undefined) return false;
    return layouts.delete(kind);
  }

  return Object.freeze({
    register,
    get,
    resolve,
    validate,
    unregister,
    has: (ref) => layouts.has(layoutKind(ref)),
    list: () => Object.freeze([...layouts.values()]),
  });
}

export function resolveLayout(layoutOrKind, registry) {
  if (!registry || typeof registry.resolve !== "function") {
    throw new TypeError("A layout registry is required to resolve a layout");
  }
  return registry.resolve(layoutOrKind);
}
