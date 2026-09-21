/**
 * Renderer-neutral outline templates used by the default planner strategy.
 *
 * Templates describe intent only.  They deliberately do not contain Deck
 * content, markup, or editor metadata so a different planner can produce the
 * same PresentationBrief contract without coupling to another layer.
 */

export const DEFAULT_PLANNER_TEMPLATES = Object.freeze([
  Object.freeze({
    id: "context",
    title: "Context",
    intention: "Establish why the topic matters.",
    slideIntentions: Object.freeze([
      Object.freeze({
        id: "opening",
        purpose: "Introduce the topic and orient the audience.",
        layoutKind: "title",
      }),
      Object.freeze({
        id: "framing",
        purpose: "Frame the context and the decision ahead.",
        layoutKind: "section",
      }),
    ]),
  }),
  Object.freeze({
    id: "insight",
    title: "Key insight",
    intention: "Make the central message clear and useful.",
    slideIntentions: Object.freeze([
      Object.freeze({
        id: "message",
        purpose: "State the central message in a memorable way.",
        layoutKind: "statement",
      }),
      Object.freeze({
        id: "evidence",
        purpose: "Explain the supporting details or evidence.",
        layoutKind: "title-body",
      }),
    ]),
  }),
  Object.freeze({
    id: "action",
    title: "Action",
    intention: "Connect the message to a concrete next step.",
    slideIntentions: Object.freeze([
      Object.freeze({
        id: "decision",
        purpose: "Clarify the choice or trade-off for the audience.",
        layoutKind: "comparison",
      }),
      Object.freeze({
        id: "next-step",
        purpose: "Close with the recommended next step.",
        layoutKind: "closing",
      }),
    ]),
  }),
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Return a mutable copy for a caller that wants to provide its own templates
 * to a planner strategy.  The exported defaults remain immutable.
 */
export function getPlannerTemplates() {
  return clone(DEFAULT_PLANNER_TEMPLATES);
}
