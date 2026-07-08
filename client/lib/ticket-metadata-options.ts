export type MetadataOption = {
  value: string;
  label: string;
  children?: MetadataOption[];
};

export const CONTACT_REASON_OPTIONS: MetadataOption[] = [
  {
    value: "pre-sale",
    label: "Pre-sale",
    children: [
      { value: "product-question", label: "Product question" },
      { value: "recommendation", label: "Recommendation" },
      { value: "notify-in-stock", label: "Notify when in stock" },
      { value: "website", label: "Website questions" },
      { value: "coupon", label: "Coupon or discount" },
    ],
  },
  {
    value: "order",
    label: "Order",
    children: [
      { value: "order-status", label: "Order status" },
      { value: "order-change", label: "Change order" },
      { value: "order-cancel", label: "Cancel order" },
    ],
  },
  {
    value: "shipping",
    label: "Shipping",
    children: [
      { value: "shipping-delay", label: "Delayed shipment" },
      { value: "shipping-lost", label: "Lost package" },
      { value: "shipping-address", label: "Address change" },
    ],
  },
  { value: "warranty", label: "Warranty" },
  { value: "exchange", label: "Exchange" },
  { value: "return", label: "Return" },
  { value: "spam", label: "Spam" },
];

export const PRODUCT_OPTIONS: MetadataOption[] = [
  { value: "general", label: "General inquiry" },
  { value: "apparel", label: "Apparel" },
  { value: "accessories", label: "Accessories" },
  { value: "digital", label: "Digital product" },
  { value: "subscription", label: "Subscription" },
];

export const RESOLUTION_OPTIONS: MetadataOption[] = [
  { value: "no-action", label: "No action" },
  { value: "refund", label: "Refund" },
  { value: "discount", label: "Discount" },
  { value: "replacement", label: "Replacement sent" },
  { value: "account-updated", label: "Updated account information" },
  { value: "information", label: "Information given" },
  {
    value: "subscription",
    label: "Subscription",
    children: [
      { value: "subscription-pause", label: "Paused subscription" },
      { value: "subscription-cancel", label: "Cancelled subscription" },
      { value: "subscription-upgrade", label: "Upgraded plan" },
    ],
  },
];

export const CUSTOMER_TYPE_OPTIONS: MetadataOption[] = [
  { value: "vip", label: "VIP" },
  { value: "collaborator", label: "Collaborator" },
  { value: "problematic", label: "Needs attention" },
  { value: "high-returns", label: "High returns" },
  { value: "fraud-review", label: "Fraud review" },
];

export function flattenMetadataOptions(options: MetadataOption[]): MetadataOption[] {
  const result: MetadataOption[] = [];
  for (const option of options) {
    result.push(option);
    if (option.children) {
      for (const child of option.children) {
        result.push({
          ...child,
          label: `${option.label} · ${child.label}`,
        });
      }
    }
  }
  return result;
}

export function findMetadataLabel(options: MetadataOption[], value?: string): string | undefined {
  if (!value) return undefined;
  for (const option of flattenMetadataOptions(options)) {
    if (option.value === value) return option.label;
  }
  return value;
}
