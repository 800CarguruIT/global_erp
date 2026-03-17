export type PlateFormat = {
  country: string;
  label?: string;
  codes?: string[];
  pattern?: string; // simple description, not a regex mask
  example?: string;
  maxLength?: number;
};

export const plateFormats: PlateFormat[] = [
  {
    country: "AE",
    label: "United Arab Emirates",
    codes: ["DXB", "AUH", "SHJ", "AJM", "RAK", "UAQ", "FUJ", "AD"],
    pattern: "Code + number (3-6 digits, sometimes one letter)",
    example: "DXB 12345",
    maxLength: 8,
  },
  {
    country: "SA",
    label: "Saudi Arabia",
    codes: ["RIY", "JED", "DMM", "MED"],
    pattern: "3 letters + 4 digits (Arabic/Latin equivalents)",
    example: "ABC 1234",
    maxLength: 8,
  },
  {
    country: "OM",
    label: "Oman",
    codes: ["MUS", "SHL", "DHA", "NIZ", "BWS"],
    pattern: "1-3 digits + 1 letter + 3-5 digits",
    example: "123 B 4567",
    maxLength: 10,
  },
  {
    country: "QA",
    label: "Qatar",
    codes: ["DOH", "QAT"],
    pattern: "Plate number only (5-6 digits)",
    example: "123456",
    maxLength: 6,
  },
  {
    country: "KW",
    label: "Kuwait",
    codes: ["KWT"],
    pattern: "Code + 5 digits",
    example: "KWT 12345",
    maxLength: 8,
  },
  {
    country: "BH",
    label: "Bahrain",
    codes: ["BHR"],
    pattern: "Digits only (4-6) or one letter + digits",
    example: "123456",
    maxLength: 7,
  },
];

export function getPlateFormat(country: string): PlateFormat | undefined {
  return plateFormats.find((p) => p.country === country);
}
