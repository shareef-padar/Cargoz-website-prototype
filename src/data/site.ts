export type SiteSettings = {
  phone: string;
  whatsapp: string;
  email: string;
  cities: string[];
  tagline: string;
};

// Sourced from prototype data.js:
//   CARGOZ_WHATSAPP = "971501234567"
//   CARGOZ_SALES    = "+97142345678"
// Email + tagline are placeholders pending brand sign-off.
export const SITE: SiteSettings = {
  phone: "+971 4 234 5678",
  whatsapp: "+971501234567",
  email: "hello@cargoz.com",
  cities: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah"],
  tagline: "The B2B marketplace for flexible warehouse storage across the UAE.",
};
