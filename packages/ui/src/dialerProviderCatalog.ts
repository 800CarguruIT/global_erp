export type DialerProviderField = {
  id: string;
  label: string;
  type: "string" | "number" | "boolean" | "password" | "url";
  required?: boolean;
  section?: "credentials" | "metadata";
  placeholder?: string;
  helpText?: string;
  defaultValue?: unknown;
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
    key: "yeastar",
    label: "Yeastar",
    description: "Yeastar P-Series OpenAPI dialer",
    defaultAuthType: "api_key",
    fields: [
      {
        id: "apiBaseUrl",
        label: "API Base URL",
        type: "url",
        required: true,
        section: "credentials",
        placeholder: "https://pbx.example.com:8088",
      },
      {
        id: "apiPath",
        label: "API Path",
        type: "string",
        section: "credentials",
        placeholder: "openapi/v1.0",
      },
      {
        id: "defaultExtension",
        label: "Default Extension",
        type: "string",
        required: true,
        section: "credentials",
        helpText: "PBX extension used as caller when from/callerId is not supplied.",
      },
      {
        id: "linkusServerUrl",
        label: "Linkus SDK Server URL",
        type: "url",
        section: "credentials",
        placeholder: "https://pbx.example.com:8088",
        helpText: "Used by browser SDK connection.",
      },
      {
        id: "linkusDefaultExtension",
        label: "Linkus Default Extension",
        type: "string",
        section: "credentials",
        helpText: "Auto-filled agent extension for SDK sign/login.",
      },
      {
        id: "accessId",
        label: "SDK Access ID",
        type: "string",
        section: "credentials",
        helpText: "Yeastar Linkus SDK AccessID (recommended).",
      },
      {
        id: "accessKey",
        label: "SDK Access Key",
        type: "password",
        section: "credentials",
        helpText: "Yeastar Linkus SDK AccessKey (recommended).",
      },
      {
        id: "username",
        label: "API Username",
        type: "string",
        section: "credentials",
        helpText: "Use with API password for get_token.",
      },
      {
        id: "password",
        label: "API Password",
        type: "password",
        section: "credentials",
      },
      {
        id: "clientId",
        label: "Client ID",
        type: "string",
        section: "credentials",
        helpText: "Alternative to username/password.",
      },
      {
        id: "clientSecret",
        label: "Client Secret",
        type: "password",
        section: "credentials",
      },
      {
        id: "autoAnswer",
        label: "Auto Answer",
        type: "string",
        section: "credentials",
        placeholder: "yes",
      },
      {
        id: "dialPermission",
        label: "Dial Permission",
        type: "string",
        section: "credentials",
      },
      {
        id: "userAgent",
        label: "User Agent",
        type: "string",
        section: "credentials",
        placeholder: "OpenAPI",
      },
      {
        id: "webhookUrl",
        label: "Webhook URL",
        type: "url",
        section: "credentials",
        helpText: "Public URL Yeastar will push call events to. e.g. http://192.168.50.169:3000/api/webhooks/dialer/yeastar",
        placeholder: "http://your-server/api/webhooks/dialer/yeastar",
      },
      {
        id: "sslVerify",
        label: "Verify SSL Cert",
        type: "boolean",
        section: "credentials",
        helpText: "Disable only for trusted self-signed/local PBX certificates.",
        defaultValue: true,
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
