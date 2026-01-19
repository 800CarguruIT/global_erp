export type DialerProviderField = {
  id: string;
  label: string;
  type: "string" | "number" | "boolean" | "password" | "url";
  required?: boolean;
  section?: "credentials" | "metadata";
  placeholder?: string;
  helpText?: string;
};

export type DialerProviderTemplate = {
  key: string;
  label: string;
  description?: string;
  defaultAuthType?: string;
  fields: DialerProviderField[];
};

export const DIALER_PROVIDER_TEMPLATES: DialerProviderTemplate[] = [
  {
    key: "twilio",
    label: "Twilio",
    description: "Twilio voice API",
    defaultAuthType: "api_key",
    fields: [
      { id: "accountSid", label: "Account SID", type: "string", required: true, section: "credentials" },
      { id: "authToken", label: "Auth Token", type: "password", required: true, section: "credentials" },
      {
        id: "defaultFromNumber",
        label: "Default From Number",
        type: "string",
        required: true,
        section: "metadata",
        helpText: "E.164, e.g. +15551234567",
      },
      {
        id: "apiBaseUrl",
        label: "API Base URL",
        type: "url",
        section: "metadata",
        placeholder: "https://api.twilio.com",
      },
    ],
  },
  {
    key: "asterisk",
    label: "Asterisk",
    fields: [
      { id: "host", label: "Host", type: "string", required: true, section: "credentials" },
      { id: "port", label: "Port", type: "number", section: "credentials", helpText: "Default 5038" },
      { id: "username", label: "Username", type: "string", required: true, section: "credentials" },
      { id: "password", label: "Password", type: "password", required: true, section: "credentials" },
      { id: "context", label: "Context", type: "string", section: "metadata" },
      { id: "callerId", label: "Caller ID", type: "string", section: "metadata" },
    ],
  },
  {
    key: "freeswitch",
    label: "FreeSWITCH",
    fields: [
      { id: "host", label: "Host", type: "string", required: true, section: "credentials" },
      { id: "port", label: "Port", type: "number", section: "credentials", helpText: "Default 8021" },
      { id: "username", label: "Username", type: "string", required: true, section: "credentials" },
      { id: "password", label: "Password", type: "password", required: true, section: "credentials" },
      { id: "profileName", label: "Profile Name", type: "string", section: "metadata" },
      { id: "callerId", label: "Caller ID", type: "string", section: "metadata" },
    ],
  },
  {
    key: "freepbx",
    label: "FreePBX",
    fields: [
      { id: "host", label: "Host", type: "string", required: true, section: "credentials" },
      {
        id: "apiKey",
        label: "API Key / Token",
        type: "password",
        required: true,
        section: "credentials",
        helpText: "Use your FreePBX API key or user token",
      },
      { id: "username", label: "Username", type: "string", section: "credentials" },
      { id: "password", label: "Password", type: "password", section: "credentials" },
      { id: "outboundRoute", label: "Outbound Route", type: "string", section: "metadata" },
    ],
  },
  {
    key: "fusionpbx",
    label: "FusionPBX",
    fields: [
      { id: "host", label: "Host", type: "string", required: true, section: "credentials" },
      { id: "apiKey", label: "API Key / Token", type: "password", required: true, section: "credentials" },
      { id: "baseUrl", label: "Base URL", type: "url", section: "metadata" },
      { id: "callerId", label: "Caller ID", type: "string", section: "metadata" },
    ],
  },
  {
    key: "issabel",
    label: "Issabel",
    fields: [
      { id: "host", label: "Host", type: "string", required: true, section: "credentials" },
      { id: "apiKey", label: "API Key / Token", type: "password", required: true, section: "credentials" },
      { id: "baseUrl", label: "Base URL", type: "url", section: "metadata" },
      { id: "callerId", label: "Caller ID", type: "string", section: "metadata" },
    ],
  },
  ...["ringcentral", "nextiva", "five9", "8x8", "dialpad"].map<DialerProviderTemplate>((key) => ({
    key,
    label: key === "8x8" ? "8x8" : key.replace(/^\w/, (c) => c.toUpperCase()),
    fields: [
      {
        id: "apiKey",
        label: "API Key / Token",
        type: "password",
        required: true,
        section: "credentials",
        helpText: `Use your ${key} API key or OAuth token`,
      },
      { id: "baseUrl", label: "Base URL", type: "url", section: "metadata" },
      { id: "defaultFromNumber", label: "Default From Number", type: "string", section: "metadata" },
    ],
  })),
  {
    key: "custom",
    label: "Custom / Other",
    description: "Use for any other dialer. Manage JSON manually.",
    fields: [],
  },
];

export const BUILT_IN_DIALER_PROVIDER_OPTIONS = DIALER_PROVIDER_TEMPLATES.map((t) => ({
  value: t.key,
  label: t.label,
}));

export function getDialerProviderTemplate(key: string): DialerProviderTemplate | undefined {
  return DIALER_PROVIDER_TEMPLATES.find((t) => t.key === key);
}
