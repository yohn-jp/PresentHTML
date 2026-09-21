/*
 * Browser-native controls for a layout contract.  This module knows about
 * slot metadata, not about any particular layout kind or renderer markup.
 * Values passed to onChange are semantic values; the DOM is only a transient
 * editing surface.
 */

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

function text(value) {
  return value === undefined || value === null ? "" : String(value);
}

function labelFor(name) {
  return String(name)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/^./, (value) => value.toUpperCase());
}

function requireElement(value, name) {
  if (!value || typeof value.replaceChildren !== "function" || typeof value.ownerDocument?.createElement !== "function") {
    throw new TypeError(`${name} must be a DOM element`);
  }
  return value;
}

function defaultImageSource() {
  return "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiIHZpZXdCb3g9IjAgMCAxIDEiPjxwYXRoIGZpbGw9IiNlMmU4ZjAiIGQ9Ik0wIDBoMXYxSDB6Ii8+PC9zdmc+";
}

/** Create a deterministic valid-ish value for a declared slot. */
export function defaultValueForSlot(slot) {
  if (!slot || typeof slot !== "object") return "";
  if (slot.cardinality === "many") return [defaultValueForSlot({ ...slot, cardinality: "one" })];
  if (slot.fields) {
    const value = {};
    Object.values(slot.fields).forEach((field) => {
      if (field.required || field.type === "image") value[field.name] = defaultValueForSlot(field);
    });
    if (slot.type === "image") {
      value.src = defaultImageSource();
      if (value.alt === undefined) value.alt = "Image";
    }
    return value;
  }
  if (slot.type === "positive-number") return 1;
  if (slot.type === "number") return 0;
  if (slot.type === "number-or-text") return "1";
  if (slot.type === "image-position") return "right";
  return slot.required ? labelFor(slot.name) : "";
}

/** Return a cloned semantic value with one field changed, without DOM state. */
export function updateContentPath(content, path, value) {
  if (!Array.isArray(path) || path.length === 0) throw new TypeError("content path must be non-empty");
  const next = clone(content);
  let target = next;
  path.slice(0, -1).forEach((key) => {
    if (target[key] === undefined || target[key] === null || typeof target[key] !== "object") {
      target[key] = typeof key === "number" ? [] : {};
    }
    target = target[key];
  });
  const last = path[path.length - 1];
  if (value === undefined && !Array.isArray(target)) delete target[last];
  else target[last] = clone(value);
  return next;
}

function parseValue(slot, raw) {
  if (slot.type === "positive-number" || slot.type === "number") {
    if (raw.trim() === "") return undefined;
    return Number(raw);
  }
  return raw;
}

function dispatchChange(path, slot, raw, onChange, onError) {
  try {
    onChange(path, parseValue(slot, raw));
  } catch (error) {
    if (onError) onError(error, path);
  }
}

function fieldElement(document, slot, path, value, onChange, onError) {
  if (slot.fields) return objectElement(document, slot, path, value, onChange, onError);

  const wrapper = document.createElement("div");
  wrapper.className = "editor-control-field";
  const id = `editor-field-${path.map((part) => String(part).replace(/[^a-zA-Z0-9_-]/g, "-")).join("-")}`;
  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = labelFor(slot.name);
  wrapper.appendChild(label);

  const control = document.createElement(slot.type === "image-position" ? "select" : "input");
  control.id = id;
  control.name = slot.name;
  control.dataset.editorField = path.join(".");
  control.dataset.editorType = slot.type;
  if (control.tagName === "SELECT") {
    ["left", "right"].forEach((optionValue) => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = labelFor(optionValue);
      control.appendChild(option);
    });
    control.value = text(value) || "right";
  } else {
    control.value = text(value);
    control.type = slot.type === "positive-number" || slot.type === "number" ? "number" : "text";
    if (control.type === "number") control.step = slot.type === "positive-number" ? "any" : "1";
  }
  if (slot.required) control.required = true;
  if (slot.description) control.setAttribute("aria-description", slot.description);
  const handler = () => dispatchChange(path, slot, control.value, onChange, onError);
  control.addEventListener("change", handler);
  control.addEventListener("input", handler);
  wrapper.appendChild(control);
  if (slot.description) {
    const hint = document.createElement("small");
    hint.className = "editor-control-help";
    hint.textContent = slot.description;
    wrapper.appendChild(hint);
  }
  return wrapper;
}

function objectElement(document, slot, path, value, onChange, onError) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "editor-control-group";
  const legend = document.createElement("legend");
  legend.textContent = labelFor(slot.name);
  fieldset.appendChild(legend);
  const source = isRecord(value) ? value : {};
  Object.values(slot.fields || {}).forEach((field) => {
    const fieldValue = source[field.name];
    fieldset.appendChild(fieldElement(document, field, [...path, field.name], fieldValue, onChange, onError));
  });
  if (slot.type === "image") {
    const fileWrapper = document.createElement("div");
    fileWrapper.className = "editor-control-field";
    const fileLabel = document.createElement("label");
    fileLabel.textContent = "Choose image file";
    const file = document.createElement("input");
    file.type = "file";
    file.accept = "image/*";
    file.dataset.editorImageInput = path.join(".");
    file.addEventListener("change", () => {
      const selected = file.files?.[0];
      if (!selected || typeof FileReader === "undefined") return;
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        if (typeof reader.result === "string") onChange([...path, "src"], reader.result);
      });
      reader.addEventListener("error", () => onError?.(new Error("Unable to read image file"), path));
      reader.readAsDataURL(selected);
    });
    fileWrapper.append(fileLabel, file);
    fieldset.appendChild(fileWrapper);
  }
  return fieldset;
}

function listElement(document, slot, path, value, onChange, onError) {
  const wrapper = document.createElement("fieldset");
  wrapper.className = "editor-control-list";
  const legend = document.createElement("legend");
  legend.textContent = labelFor(slot.name);
  wrapper.appendChild(legend);
  const values = Array.isArray(value) ? value : [];
  const itemSlot = { ...slot, cardinality: "one" };
  values.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "editor-control-list-item";
    row.appendChild(fieldElement(document, itemSlot, [...path, index], item, onChange, onError));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "editor-button editor-button--small";
    remove.textContent = "Remove";
    remove.dataset.editorRemoveItem = [...path, index].join(".");
    remove.addEventListener("click", () => onChange(path, values.filter((_, itemIndex) => itemIndex !== index)));
    row.appendChild(remove);
    wrapper.appendChild(row);
  });
  const add = document.createElement("button");
  add.type = "button";
  add.className = "editor-button editor-button--small";
  add.textContent = `Add ${labelFor(slot.name).toLowerCase()}`;
  add.dataset.editorAddItem = path.join(".");
  add.addEventListener("click", () => onChange(path, [...values, defaultValueForSlot(itemSlot)]));
  wrapper.appendChild(add);
  return wrapper;
}

/** Render controls for every declared slot in a contract. */
export function createContentControls({ root, contract, content = {}, onChange, onError } = {}) {
  const element = requireElement(root, "content controls root");
  if (!contract || !Array.isArray(contract.slots)) throw new TypeError("content controls require a layout contract");
  if (typeof onChange !== "function") throw new TypeError("content controls onChange must be a function");
  const document = element.ownerDocument;
  let currentContent = clone(content);
  let destroyed = false;

  function render(nextContent = currentContent) {
    if (destroyed) return;
    currentContent = clone(nextContent || {});
    element.replaceChildren();
    contract.slots.forEach((slot) => {
      const value = currentContent[slot.name];
      const node = slot.cardinality === "many"
        ? listElement(document, slot, [slot.name], value, handleChange, onError)
        : fieldElement(document, slot, [slot.name], value, handleChange, onError);
      element.appendChild(node);
    });
  }

  function handleChange(path, value) {
    const nextContent = updateContentPath(currentContent, path, value);
    onChange(nextContent, path, value);
  }

  render();
  return Object.freeze({
    render,
    getContent: () => clone(currentContent),
    destroy() {
      destroyed = true;
      element.replaceChildren();
    },
  });
}
