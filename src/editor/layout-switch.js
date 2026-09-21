import { defaultValueForSlot } from "./content-controls.js";

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clone(value) {
  if (Array.isArray(value)) return value.map((item) => clone(item));
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  return value;
}

function compatibleValue(value, sourceSlot, targetSlot) {
  if (!sourceSlot || !targetSlot) return false;
  if ((sourceSlot.cardinality || "one") !== (targetSlot.cardinality || "one")) return false;
  if (sourceSlot.cardinality === "many") {
    if (!Array.isArray(value)) return false;
    return true;
  }
  if (sourceSlot.fields || targetSlot.fields) {
    if (!sourceSlot.fields || !targetSlot.fields || !isRecord(value)) return false;
    // Object slots can still migrate field-by-field when one nested field's
    // type changes.  The incompatible field is initialized below while
    // compatible siblings remain intact.
    return true;
  }
  return sourceSlot.type === targetSlot.type;
}

function migrateValue(value, sourceSlot, targetSlot) {
  if (!compatibleValue(value, sourceSlot, targetSlot)) return undefined;
  if (targetSlot.cardinality === "many") {
    return value
      .map((item) => migrateValue(item, { ...sourceSlot, cardinality: "one" }, { ...targetSlot, cardinality: "one" }))
      .filter((item) => item !== undefined);
  }
  if (targetSlot.fields) {
    const next = {};
    Object.values(targetSlot.fields).forEach((targetField) => {
      const sourceField = sourceSlot.fields?.[targetField.name];
      const migrated = sourceField && isRecord(value)
        ? migrateValue(value[targetField.name], sourceField, targetField)
        : undefined;
      if (migrated !== undefined) next[targetField.name] = migrated;
      else if (targetField.required) next[targetField.name] = defaultValueForSlot(targetField);
    });
    return next;
  }
  return clone(value);
}

function slotMap(contract) {
  return new Map((contract?.slots || []).map((slot) => [slot.name, slot]));
}

/**
 * Migrate semantic content using only source/target layout metadata.  Shared
 * compatible slots are retained in declaration order; all other target
 * values are initialized from deterministic contract defaults.
 */
export function migrateLayoutContent(content, sourceContract, targetContract) {
  if (!targetContract || !Array.isArray(targetContract.slots) || typeof targetContract.validate !== "function") {
    throw new TypeError("target layout contract is required");
  }
  const sourceSlots = slotMap(sourceContract);
  const source = isRecord(content) ? content : {};
  const migrated = {};
  targetContract.slots.forEach((targetSlot) => {
    const sourceSlot = sourceSlots.get(targetSlot.name);
    const value = sourceSlot ? migrateValue(source[targetSlot.name], sourceSlot, targetSlot) : undefined;
    if (value !== undefined) migrated[targetSlot.name] = value;
    else if (targetSlot.required) migrated[targetSlot.name] = defaultValueForSlot(targetSlot);
  });

  try {
    return clone(targetContract.validate(migrated));
  } catch (error) {
    // A custom contract may have stricter rules than its metadata.  Rebuild
    // all required fields deterministically and let its canonical validator
    // decide whether the target is usable.
    const fallback = {};
    targetContract.slots.forEach((slot) => {
      if (slot.required) fallback[slot.name] = defaultValueForSlot(slot);
    });
    return clone(targetContract.validate(fallback));
  }
}

function requireElement(value, name) {
  if (!value || typeof value.replaceChildren !== "function" || typeof value.ownerDocument?.createElement !== "function") {
    throw new TypeError(`${name} must be a DOM element`);
  }
  return value;
}

function resolveRegistry(registry) {
  if (!registry || typeof registry.resolve !== "function" || typeof registry.list !== "function") {
    throw new TypeError("layout switcher requires a layout registry");
  }
  return registry;
}

/** Apply one deterministic layout transition through the semantic store. */
export function switchSlideLayout({ store, layoutRegistry, registry, slideId, layoutKind } = {}) {
  if (!store || typeof store.getState !== "function" || typeof store.updateSlideLayout !== "function") {
    throw new TypeError("layout switch requires an editor store");
  }
  const layouts = resolveRegistry(layoutRegistry || registry);
  const state = store.getState();
  const id = slideId === undefined ? state.activeSlideId : slideId;
  const slide = state.deck.slides.find((item) => item.id === id);
  if (!slide) throw new RangeError(`Slide not found: ${id}`);
  const source = layouts.resolve(slide.layout.kind);
  const target = layouts.resolve(layoutKind);
  const content = migrateLayoutContent(slide.layout.content, source, target);
  return store.updateSlideLayout(id, { kind: target.kind, content });
}

/** Render a contract-driven layout selector as a replaceable editor adapter. */
export function createLayoutSwitcher({ root, store, layoutRegistry, registry, onError } = {}) {
  const element = requireElement(root, "layout switcher root");
  const layouts = resolveRegistry(layoutRegistry || registry);
  let destroyed = false;
  let select;

  function render(state = store.getState()) {
    if (destroyed) return;
    element.replaceChildren();
    const label = element.ownerDocument.createElement("label");
    label.textContent = "Layout";
    select = element.ownerDocument.createElement("select");
    select.name = "layout";
    select.dataset.editorLayout = "true";
    layouts.list().forEach((contract) => {
      const option = element.ownerDocument.createElement("option");
      option.value = contract.kind;
      option.textContent = contract.name || contract.kind;
      select.appendChild(option);
    });
    const active = state.deck.slides.find((slide) => slide.id === state.activeSlideId);
    if (active) select.value = active.layout.kind;
    select.addEventListener("change", () => {
      try {
        switchSlideLayout({
          store,
          layoutRegistry: layouts,
          slideId: store.getState().activeSlideId,
          layoutKind: select.value,
        });
      } catch (error) {
        if (onError) onError(error);
        render();
      }
    });
    element.append(label, select);
  }

  if (!store || typeof store.getState !== "function" || typeof store.subscribe !== "function") {
    throw new TypeError("layout switcher store must expose getState() and subscribe()");
  }
  const unsubscribe = store.subscribe(render);
  render();
  return Object.freeze({
    render,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      element.replaceChildren();
    },
  });
}
