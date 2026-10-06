/*
 * BRIXTA_FIELD_APP_V1 — ready-made field workflows.
 *
 * A template is only a starting point: it is copied into the list's field
 * app draft and published from there. Everything a template may contain is
 * defined by the shared contract (./field-app-contract.ts), which the
 * backend uses too, so new templates need no backend or app changes.
 */

import {
  inputSpec,
  type ConditionOp,
  type FieldInputType,
} from "./field-app-contract";

export type { FieldInputType };

export type FieldTemplateInput = {
  key: string;
  label: string;
  type: FieldInputType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  unit?: string;
  help?: string;
  min?: number;
  max?: number;
  maxPhotos?: number;
  formula?: string;
  decimals?: number;
  showWhen?: { field: string; op: ConditionOp; values?: string[] };
};

export type FieldTemplateSection = {
  key: string;
  title: string;
  hint?: string;
  requires?: string[];
  setsStage?: string;
  stageWhen?: Array<{ field: string; equals: string; stage: string }>;
  fields: FieldTemplateInput[];
};

export type FieldTemplateStage = {
  key: string;
  label: string;
  tone: "neutral" | "info" | "good" | "warning" | "danger";
  closed?: boolean;
  terminal?: boolean;
};

export type FieldAppTemplate = {
  key: string;
  title: string;
  description: string;
  followUpField: string | null;
  stages: FieldTemplateStage[];
  sections: FieldTemplateSection[];
};

const ACTIVE_SITE = {
  field: "site_status",
  op: "any_of" as const,
  values: ["Active construction", "Work paused"],
};

const PITCHED = { field: "pitch_attempted", op: "is" as const, values: ["Yes"] };

const INTERESTED = {
  field: "customer_interest",
  op: "any_of" as const,
  values: ["Hot", "Warm", "Cold"],
};

export const FIELD_STAGES: FieldTemplateStage[] = [
  { key: "new", label: "Not visited", tone: "neutral" },
  { key: "visited", label: "Visited", tone: "neutral" },
  { key: "verified", label: "Verified", tone: "info" },
  { key: "contacted", label: "Contact added", tone: "info" },
  { key: "pitched", label: "Pitched", tone: "warning" },
  { key: "follow_up", label: "Follow-up", tone: "warning" },
  { key: "won", label: "Order", tone: "good", closed: true, terminal: true },
  { key: "lost", label: "Lost", tone: "danger", closed: true },
  { key: "not_a_site", label: "Not a site", tone: "neutral", closed: true },
];

export const FIELD_APP_TEMPLATES: FieldAppTemplate[] = [
  {
    key: "construction_site_visit",
    title: "Construction site visit",
    description:
      "Verify the site, add the key people, record the pitch, set the next step and log the order.",
    followUpField: "follow_up_date",
    stages: FIELD_STAGES,
    sections: [
      {
        key: "verify",
        title: "Verify site",
        hint: "Check in at the site, take photos and confirm the stage.",
        setsStage: "verified",
        stageWhen: [
          { field: "site_status", equals: "Not construction", stage: "not_a_site" },
          { field: "site_status", equals: "Can't get in", stage: "visited" },
        ],
        fields: [
          { key: "site_checkin", label: "Check in at the site", type: "gps", required: true },
          {
            key: "site_status",
            label: "What's here?",
            type: "choice",
            required: true,
            options: [
              "Active construction",
              "Work paused",
              "Already finished",
              "Not construction",
              "Can't get in",
            ],
          },
          {
            key: "construction_stage",
            label: "Construction stage",
            type: "choice",
            showWhen: ACTIVE_SITE,
            options: [
              "Land cleared",
              "Digging",
              "Footing",
              "Foundation / plinth",
              "Columns & beams",
              "Roof slab",
              "Brick walls",
              "Plaster",
              "Finishing & paint",
            ],
          },
          { key: "site_photos", label: "Site photos", type: "photos" },
          {
            key: "site_type",
            label: "What's being built?",
            type: "choice",
            showWhen: ACTIVE_SITE,
            options: ["Independent house", "Apartment", "Shop / office", "Other"],
          },
          {
            key: "floors_planned",
            label: "Floors planned",
            type: "number",
            placeholder: "e.g. 2",
            min: 0,
            max: 200,
            showWhen: ACTIVE_SITE,
          },
          { key: "site_address", label: "Address or landmark", type: "long_text", placeholder: "Lane, landmark, locality" },
          { key: "verify_notes", label: "Notes", type: "long_text" },
        ],
      },
      {
        key: "contact",
        title: "Key people",
        hint: "Who decides, who buys, who builds.",
        requires: ["verify"],
        setsStage: "contacted",
        fields: [
          { key: "key_person_name", label: "Key person's name", type: "text", required: true },
          {
            key: "key_person_role",
            label: "Their role",
            type: "choice",
            options: ["Owner", "Contractor", "Engineer", "Architect", "Mason", "Family member"],
          },
          { key: "key_person_phone", label: "Phone number", type: "phone", required: true },
          { key: "alternate_phone", label: "Alternate number", type: "phone" },
          { key: "contractor_name", label: "Contractor", type: "text" },
          { key: "builder_name", label: "Builder / developer", type: "text" },
          { key: "architect_name", label: "Architect / engineer", type: "text" },
        ],
      },
      {
        key: "pitch",
        title: "Pitch",
        hint: "What you offered and how they reacted.",
        requires: ["verify"],
        setsStage: "pitched",
        stageWhen: [{ field: "customer_interest", equals: "Not interested", stage: "lost" }],
        fields: [
          { key: "pitch_attempted", label: "Did you pitch?", type: "yes_no", required: true },
          {
            key: "customer_interest",
            label: "How interested?",
            type: "choice",
            showWhen: PITCHED,
            options: ["Hot", "Warm", "Cold", "Not interested"],
          },
          {
            key: "product_requirement",
            label: "What do they need?",
            type: "text",
            placeholder: "Products",
            showWhen: INTERESTED,
          },
          {
            key: "expected_quantity",
            label: "Expected quantity",
            type: "text",
            placeholder: "e.g. 3 tonnes, 180 bags",
            showWhen: INTERESTED,
          },
          {
            key: "lead_stage",
            label: "Lead stage",
            type: "choice",
            showWhen: INTERESTED,
            options: ["New lead", "Qualified", "Negotiating", "Won", "Lost"],
          },
          { key: "pitch_notes", label: "Pitch notes", type: "long_text" },
        ],
      },
      {
        key: "follow_up",
        title: "Follow-up",
        hint: "The next step and when.",
        requires: ["verify"],
        setsStage: "follow_up",
        fields: [
          {
            key: "next_action",
            label: "Next step",
            type: "choice",
            required: true,
            options: ["Call back", "Visit again", "Send quote", "Bring the dealer"],
          },
          { key: "follow_up_date", label: "When", type: "date", required: true },
          { key: "follow_up_notes", label: "Notes", type: "long_text" },
        ],
      },
      {
        key: "order",
        title: "Order",
        hint: "When the customer says yes.",
        requires: ["verify"],
        setsStage: "won",
        stageWhen: [{ field: "order_status", equals: "Cancelled", stage: "lost" }],
        fields: [
          { key: "order_number", label: "Order number", type: "text", required: true },
          { key: "order_value", label: "Order value", type: "currency", unit: "₹" },
          { key: "order_product", label: "Product", type: "text" },
          { key: "order_quantity", label: "Quantity", type: "text" },
          {
            key: "order_status",
            label: "Order status",
            type: "choice",
            options: ["Placed", "Confirmed", "Delivered", "Cancelled"],
          },
          {
            key: "order_signature",
            label: "Customer signature",
            type: "signature",
            help: "Optional. Ask the customer to sign on your phone.",
          },
        ],
      },
    ],
  },
  {
    key: "simple_visit",
    title: "Simple visit",
    description: "Check in, take photos, note the outcome and set a follow-up. Works for any list.",
    followUpField: "follow_up_date",
    stages: [
      { key: "new", label: "Not visited", tone: "neutral" },
      { key: "verified", label: "Visited", tone: "info" },
      { key: "follow_up", label: "Follow-up", tone: "warning" },
      { key: "done", label: "Done", tone: "good", closed: true },
    ],
    sections: [
      {
        key: "visit",
        title: "Visit",
        setsStage: "verified",
        stageWhen: [{ field: "visit_outcome", equals: "Done", stage: "done" }],
        fields: [
          { key: "visit_checkin", label: "Check in", type: "gps", required: true },
          { key: "visit_photos", label: "Photos", type: "photos" },
          {
            key: "visit_outcome",
            label: "Outcome",
            type: "choice",
            required: true,
            options: ["Done", "Needs another visit", "Couldn't meet"],
          },
          { key: "visit_notes", label: "Notes", type: "long_text" },
        ],
      },
      {
        key: "follow_up",
        title: "Follow-up",
        requires: ["visit"],
        setsStage: "follow_up",
        fields: [
          { key: "follow_up_date", label: "When", type: "date", required: true },
          { key: "follow_up_notes", label: "Notes", type: "long_text" },
        ],
      },
    ],
  },
  {
    key: "dealer_visit",
    title: "Dealer / shop visit",
    description:
      "Check in at the counter, rate the shop, check stock and book an order with the total worked out for you.",
    followUpField: "next_visit_date",
    stages: [
      { key: "new", label: "Not visited", tone: "neutral" },
      { key: "visited", label: "Visited", tone: "info" },
      { key: "follow_up", label: "Follow-up", tone: "warning" },
      { key: "won", label: "Order booked", tone: "good", closed: true, terminal: true },
      { key: "lost", label: "Lost", tone: "danger", closed: true },
    ],
    sections: [
      {
        key: "visit",
        title: "Shop visit",
        hint: "Check in, take a photo of the counter and see what they stock.",
        setsStage: "visited",
        fields: [
          { key: "shop_checkin", label: "Check in at the shop", type: "gps", required: true },
          { key: "shop_photos", label: "Shop photos", type: "photos", maxPhotos: 4 },
          { key: "shop_rating", label: "Shop condition", type: "rating", max: 5, required: true },
          {
            key: "brands_stocked",
            label: "Brands they stock",
            type: "multi_choice",
            options: ["Ours", "Competitor A", "Competitor B", "Local brand"],
          },
          {
            key: "our_stock_bags",
            label: "Our bags in stock",
            type: "number",
            min: 0,
            showWhen: { field: "brands_stocked", op: "any_of", values: ["Ours"] },
          },
          { key: "shop_notes", label: "Notes", type: "long_text" },
        ],
      },
      {
        key: "order",
        title: "Book order",
        hint: "Quantity and rate — the total is worked out for you.",
        requires: ["visit"],
        setsStage: "won",
        fields: [
          {
            key: "order_info",
            label: "Before you book",
            type: "note",
            help: "Confirm the rate with the dealer and ask them to sign on your phone.",
          },
          { key: "order_bags", label: "Bags", type: "number", required: true, min: 1, unit: "bags" },
          { key: "order_rate", label: "Rate per bag", type: "currency", required: true, unit: "₹" },
          {
            key: "order_total",
            label: "Order total",
            type: "calculated",
            formula: "order_bags * order_rate",
            decimals: 0,
            unit: "₹",
          },
          { key: "delivery_date", label: "Delivery date", type: "date" },
          { key: "delivery_time", label: "Delivery time", type: "time" },
          { key: "dealer_email", label: "Dealer email", type: "email", help: "For the order confirmation." },
          { key: "dealer_confirmed", label: "Dealer confirmed this order", type: "checkbox", required: true },
          { key: "dealer_signature", label: "Dealer signature", type: "signature" },
        ],
      },
      {
        key: "follow_up",
        title: "Next visit",
        requires: ["visit"],
        setsStage: "follow_up",
        fields: [
          { key: "next_visit_date", label: "When", type: "date", required: true },
          { key: "next_visit_reason", label: "Why", type: "text" },
        ],
      },
    ],
  },
];

/** How a template input is stored as an Entity field (null = not stored). */
export function entityDataTypeFor(type: FieldInputType): string | null {
  return inputSpec(type).dataType;
}
