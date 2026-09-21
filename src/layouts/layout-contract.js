/**
 * Renderer-neutral contract for a semantic layout.
 *
 * Layout contracts describe the content a slide carries.  They deliberately
 * do not contain DOM, CSS, or geometry, so a renderer can be replaced without
 * changing a Deck's persisted data.
 */

export const LAYOUT_CONTRACT_ID = "presenthtml-layout";
export const LAYOUT_CONTRACT_VERSION = 1;

export const MISSING_CONTENT_POLICIES = Object.freeze({
  REQUIRED: "error",
  OPTIONAL: "omit",
});

export const OVERFLOW_POLICIES = Object.freeze({
  PRESERVE: "preserve",
});

const CARDINALITIES = Object.freeze(["one", "many"]);

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clone(value) {
  if (Array.isArray(value)) return value.map((item) => clone(item));
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  }
  return value;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach((item) => deepFreeze(item));
    Object.freeze(value);
  }
  return value;
}

function fail(path, message) {
  throw new TypeError(`Invalid layout contract at ${path}: ${message}`);
}

function expectRecord(value, path) {
  if (!isPlainObject(value)) fail(path, "expected a plain object");
}

function expectString(value, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(path, "expected a non-empty string");
  }
}

function expectBoolean(value, path) {
  if (typeof value !== "boolean") fail(path, "expected a boolean");
}

function assertAllowedKeys(value, allowed, path) {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) fail(`${path}.${unknown}`, "unsupported field");
}

function normalizeSlot(slot, path) {
  expectRecord(slot, path);
  assertAllowedKeys(slot, ["name", "type", "required", "cardinality", "fields", "description", "overflow"], path);
  expectString(slot.name, `${path}.name`);
  expectString(slot.type, `${path}.type`);
  expectBoolean(slot.required, `${path}.required`);

  const cardinality = slot.cardinality === undefined ? "one" : slot.cardinality;
  if (!CARDINALITIES.includes(cardinality)) {
    fail(`${path}.cardinality`, `expected one of ${CARDINALITIES.join(", ")}`);
  }

  const normalized = {
    name: slot.name,
    type: slot.type,
    required: slot.required,
    cardinality,
  };

  if (slot.description !== undefined) {
    expectString(slot.description, `${path}.description`);
    normalized.description = slot.description;
  }

  if (slot.overflow !== undefined) {
    expectRecord(slot.overflow, `${path}.overflow`);
    assertAllowedKeys(slot.overflow, ["policy"], `${path}.overflow`);
    if (slot.overflow.policy !== OVERFLOW_POLICIES.PRESERVE) {
      fail(`${path}.overflow.policy`, `expected ${OVERFLOW_POLICIES.PRESERVE}`);
    }
    normalized.overflow = { policy: slot.overflow.policy };
  }

  if (slot.fields !== undefined) {
    expectRecord(slot.fields, `${path}.fields`);
    normalized.fields = Object.fromEntries(
      Object.entries(slot.fields).map(([name, field]) => {
        if (name.trim().length === 0) fail(`${path}.fields`, "field names must be non-empty");
        return [name, normalizeSlot({ name, ...field }, `${path}.fields.${name}`)];
      }),
    );
  }

  return normalized;
}

function assertUniqueSlotNames(slots, path) {
  const seen = new Set();
  slots.forEach((slot, index) => {
    if (seen.has(slot.name)) fail(`${path}[${index}].name`, "duplicate slot name");
    seen.add(slot.name);
  });
}

function validateContractShape(contract) {
  expectRecord(contract, "layout");
  assertAllowedKeys(
    contract,
    [
      "id",
      "version",
      "kind",
      "name",
      "description",
      "slots",
      "slotNames",
      "requiredSlots",
      "optionalSlots",
      "missingContent",
      "overflow",
      "validate",
      "getSlot",
    ],
    "layout",
  );
  if (contract.id !== undefined) expectString(contract.id, "layout.id");
  if (contract.version !== undefined && contract.version !== LAYOUT_CONTRACT_VERSION) {
    fail("layout.version", `expected ${LAYOUT_CONTRACT_VERSION}`);
  }
  expectString(contract.kind, "layout.kind");
  if (contract.name !== undefined) expectString(contract.name, "layout.name");
  if (contract.description !== undefined) expectString(contract.description, "layout.description");
  if (!Array.isArray(contract.slots) || contract.slots.length === 0) {
    fail("layout.slots", "expected a non-empty array");
  }
  const slots = contract.slots.map((slot, index) => normalizeSlot(slot, `layout.slots[${index}]`));
  assertUniqueSlotNames(slots, "layout.slots");
  expectRecord(contract.missingContent, "layout.missingContent");
  assertAllowedKeys(contract.missingContent, ["required", "optional"], "layout.missingContent");
  if (contract.missingContent.required !== MISSING_CONTENT_POLICIES.REQUIRED) {
    fail("layout.missingContent.required", `expected ${MISSING_CONTENT_POLICIES.REQUIRED}`);
  }
  if (contract.missingContent.optional !== MISSING_CONTENT_POLICIES.OPTIONAL) {
    fail("layout.missingContent.optional", `expected ${MISSING_CONTENT_POLICIES.OPTIONAL}`);
  }
  expectRecord(contract.overflow, "layout.overflow");
  assertAllowedKeys(contract.overflow, ["policy"], "layout.overflow");
  if (contract.overflow.policy !== OVERFLOW_POLICIES.PRESERVE) {
    fail("layout.overflow.policy", `expected ${OVERFLOW_POLICIES.PRESERVE}`);
  }
  if (typeof contract.validate !== "function") fail("layout.validate", "expected a function");
  return slots;
}

/** Return whether a value is a layout contract created by this module. */
export function isLayoutContract(value) {
  return isPlainObject(value)
    && value.id === LAYOUT_CONTRACT_ID
    && value.version === LAYOUT_CONTRACT_VERSION
    && typeof value.kind === "string"
    && Array.isArray(value.slots)
    && typeof value.validate === "function";
}

/** Validate a layout contract's metadata without changing it. */
export function validateLayoutContract(contract) {
  validateContractShape(contract);
  return contract;
}

/**
 * Create an immutable layout contract.  The validator is the only place that
 * knows the content's detailed value rules; this wrapper standardizes the
 * registry boundary and returns an isolated value to callers.
 */
export function createLayoutContract(input = {}) {
  expectRecord(input, "layout");
  expectString(input.kind, "layout.kind");
  if (typeof input.validate !== "function") {
    fail("layout.validate", "expected a function");
  }

  const sourceValidator = input.validate;
  const slots = Array.isArray(input.slots)
    ? input.slots.map((slot, index) => normalizeSlot(slot, `layout.slots[${index}]`))
    : input.slots;
  if (!Array.isArray(slots) || slots.length === 0) fail("layout.slots", "expected a non-empty array");
  assertUniqueSlotNames(slots, "layout.slots");

  const missingContent = input.missingContent || {
    required: MISSING_CONTENT_POLICIES.REQUIRED,
    optional: MISSING_CONTENT_POLICIES.OPTIONAL,
  };
  const overflow = input.overflow || { policy: OVERFLOW_POLICIES.PRESERVE };
  const metadata = {
    id: LAYOUT_CONTRACT_ID,
    version: LAYOUT_CONTRACT_VERSION,
    kind: input.kind,
    slots,
    slotNames: slots.map((slot) => slot.name),
    requiredSlots: slots.filter((slot) => slot.required).map((slot) => slot.name),
    optionalSlots: slots.filter((slot) => !slot.required).map((slot) => slot.name),
    missingContent,
    overflow,
  };
  if (input.name !== undefined) metadata.name = input.name;
  if (input.description !== undefined) metadata.description = input.description;

  const validate = (content) => {
    const validated = sourceValidator(content);
    const value = validated === undefined ? content : validated;
    if (!isPlainObject(value)) fail(`layout.${input.kind}.content`, "validator must return a plain object");
    return clone(value);
  };

  metadata.validate = validate;
  metadata.getSlot = (name) => metadata.slots.find((slot) => slot.name === name);

  validateLayoutContract(metadata);
  return deepFreeze(metadata);
}

/** Validate semantic content through a contract without involving a renderer. */
export function validateLayoutContent(contract, content) {
  if (!isLayoutContract(contract)) {
    throw new TypeError("A layout contract is required to validate content");
  }
  return contract.validate(content);
}
