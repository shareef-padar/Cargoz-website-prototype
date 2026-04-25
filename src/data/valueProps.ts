export type ValueProp = { title: string; body: string; icon: "shield" | "clock" | "wallet" };

export const VALUE_PROPS: ValueProp[] = [
  {
    title: "Verified warehouses",
    body: "Every listing is inspected by our team. Photos, facilities, and pricing match what you'll see on site.",
    icon: "shield",
  },
  {
    title: "Move in within 48 hours",
    body: "Browse, shortlist, sign, and start storing — typically inside 2 business days.",
    icon: "clock",
  },
  {
    title: "No annual lock-ins",
    body: "Pay per month. Switch on a month's notice. Scale up or down as your business changes.",
    icon: "wallet",
  },
];
