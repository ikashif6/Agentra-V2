export type ContentType =
  | "text"
  | "product_cards"
  | "order_card"
  | "input_form"
  | "choices"
  | "action_buttons"
  | "system_event"
  | "attachments"
  | "rating";

export interface ChatAttachment {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  kind: "image" | "file";
}

export type MessageRole = "customer" | "assistant" | "agent" | "system";

export type HandoffState =
  | "not_requested"
  | "requested"
  | "connecting"
  | "assigned"
  | "agent_joined"
  | "unavailable"
  | "outside_business_hours"
  | "cancelled_by_customer";

export type ConversationGoal =
  | "general"
  | "product_search"
  | "product_recommend"
  | "product_availability"
  | "product_compare"
  | "size_fit"
  | "place_order"
  | "order_lookup"
  | "order_status"
  | "tracking"
  | "return_request"
  | "refund_status"
  | "initiate_refund"
  | "cancellation"
  | "address_change"
  | "damaged_item"
  | "incorrect_item"
  | "missing_item"
  | "policy"
  | "store_info"
  | "contact"
  | "ticket"
  | "handoff"
  | "back_in_stock"
  | "exchange_request"
  | "partial_return"
  | "late_delivery"
  | "lost_delivery"
  | "delivery_estimate"
  | "shipping_cost"
  | "discount_help"
  | "payment_issue"
  | "reorder"
  | "custom_product_request"
  | "abandoned_cart"
  | "similar_products";

export interface ProductCard {
  id: string;
  title: string;
  imageUrl?: string;
  price?: string | number;
  currency?: string;
  url?: string;
  available?: boolean;
  reason?: string;
  variants?: Array<{ id: string; title: string; available: boolean }>;
}

export interface OrderCardPayload {
  orderId: string;
  orderNumber: string;
  total?: string;
  currency?: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  shipmentStatus?: string;
  refundStatus?: string;
  cancellationStatus?: string;
  badge?: string;
  items?: Array<{ title: string; quantity: number }>;
  tracking?: {
    number?: string;
    carrier?: string;
    url?: string;
    estimate?: string;
  };
  stepper?: {
    current: "placed" | "packed" | "shipped" | "delivered";
    steps?: string[];
  };
  outcome?: "refunded" | "cancelled" | null;
}

export interface FormField {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "textarea" | "select";
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

export interface InputFormPayload {
  formId: string;
  title: string;
  summary?: string[];
  fields: FormField[];
  submitLabel?: string;
  actionId?: string;
  confirmToken?: string;
}

export interface ChoiceOption {
  id: string;
  label: string;
  value: string;
}

export interface RatingOption {
  id: string;
  emoji: string;
  label: string;
  score: number;
}

export interface RatingPayload {
  prompt?: string;
  options: RatingOption[];
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  contentType: ContentType;
  body?: string;
  senderName?: string;
  sentAt: string;
  products?: ProductCard[];
  order?: OrderCardPayload;
  form?: InputFormPayload;
  choices?: ChoiceOption[];
  rating?: RatingPayload;
  actionButtons?: Array<{ id: string; label: string; value: string }>;
  attachments?: ChatAttachment[];
  systemEvent?: {
    type: string;
    text: string;
  };
}

export interface ConversationSlots {
  email?: string;
  phone?: string;
  orderNumber?: string;
  orderId?: string;
  productQuery?: string;
  productType?: string;
  size?: string;
  color?: string;
  style?: string;
  material?: string;
  budget?: string;
  occasion?: string;
  returnReason?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  issueDescription?: string;
  [key: string]: string | undefined;
}

export interface VerifiedOrderSnapshot {
  orderId: string;
  orderNumber: string;
  financialStatus: string;
  fulfillmentStatus: string;
  shipmentStatus: string;
  refundStatus: string;
  cancellationStatus: string;
  stepperCurrent?: "placed" | "packed" | "shipped" | "delivered";
  trackingNumber?: string;
  trackingUrl?: string;
  cancelEligible?: boolean;
  addressChangeEligible?: boolean;
  returnEligible?: boolean;
  updatedAt: string;
}

export interface LastTurnOutcome {
  type:
    | "order_found"
    | "order_not_found"
    | "tool_error"
    | "clarify"
    | "form_shown"
    | "general";
  code?: string;
  summary?: string;
  attemptedOrderNumber?: string;
  attemptedEmail?: string;
  at: string;
}

export interface ConversationState {
  goal: ConversationGoal;
  slots: ConversationSlots;
  activeFlow?: string | null;
  flowStep?: string | null;
  handoffState: HandoffState;
  verifiedOrderId?: string | null;
  /** Last verified order facts for follow-up Q&A without re-showing cards */
  verifiedOrderSnapshot?: VerifiedOrderSnapshot | null;
  /** What happened on the previous assistant turn — for contextual follow-ups */
  lastTurnOutcome?: LastTurnOutcome | null;
  humanTakeover: boolean;
  /** Detected customer language (BCP-47-ish), e.g. en, es, fr */
  language?: string | null;
  /** Urgency: low | normal | high | critical */
  urgency?: "low" | "normal" | "high" | "critical" | null;
  pendingAction?: {
    actionId: string;
    tool: string;
    args: Record<string, unknown>;
    confirmToken: string;
  } | null;
}

export interface TurnRequest {
  workspaceId: string;
  conversationId?: string;
  sessionToken: string;
  message: string;
  visitorEmail?: string;
  formSubmission?: {
    formId: string;
    actionId?: string;
    confirmToken?: string;
    values: Record<string, string>;
  };
  choiceId?: string;
  channel?: string;
  attachments?: ChatAttachment[];
}

export interface TurnResponse {
  conversationId: string;
  sessionToken: string;
  messages: ChatMessage[];
  conversationState: ConversationState;
  handoffState: HandoffState;
  queuePosition?: number;
  estimatedWaitMinutes?: number;
  queueLabel?: string;
}

export interface ToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
  requiresHuman?: boolean;
  ui?: {
    contentType: ContentType;
    products?: ProductCard[];
    order?: OrderCardPayload;
    form?: InputFormPayload;
    choices?: ChoiceOption[];
    rating?: RatingPayload;
    actionButtons?: Array<{ id: string; label: string; value: string }>;
    systemEvent?: { type: string; text: string };
  };
}
