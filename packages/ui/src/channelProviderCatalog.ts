export type ChannelType =
  | "email"
  | "sms"
  | "whatsapp"
  | "meta"
  | "messaging"
  | "ads"
  | "analytics"
  | "social";

export type ChannelCategory =
  | "Advertising"
  | "Analytics"
  | "Social"
  | "Email"
  | "Messaging";

export type ChannelProviderField = {
  id: string;
  label: string;
  type: "string" | "number" | "boolean" | "password" | "url" | "email";
  required?: boolean;
  section?: "credentials" | "metadata";
  placeholder?: string;
  helpText?: string;
};

export type ChannelProviderTemplate = {
  key: string;
  label: string;
  category: ChannelCategory;
  channelType: ChannelType;
  description?: string;
  defaultAuthType?: string;
  fields: ChannelProviderField[];
};

export function getChannelCategoryForType(channelType: ChannelType): ChannelCategory {
  switch (channelType) {
    case "ads":
      return "Advertising";
    case "analytics":
      return "Analytics";
    case "social":
    case "meta":
      return "Social";
    case "email":
      return "Email";
    case "sms":
    case "whatsapp":
    case "messaging":
    default:
      return "Messaging";
  }
}

export const CHANNEL_PROVIDER_TEMPLATES: ChannelProviderTemplate[] = [
  // Advertising
  {
    key: "google-ads",
    label: "Google Ads API",
    category: "Advertising",
    channelType: "ads",
    fields: [
      { id: "clientId", label: "Client ID", type: "string", required: true, section: "credentials" },
      { id: "clientSecret", label: "Client Secret", type: "password", required: true, section: "credentials" },
      { id: "developerToken", label: "Developer Token", type: "password", required: true, section: "credentials" },
      { id: "refreshToken", label: "Refresh Token", type: "password", required: true, section: "credentials" },
      {
        id: "managerCustomerId",
        label: "Manager Customer ID",
        type: "string",
        section: "metadata",
        helpText: "MCC ID, e.g. 123-456-7890",
      },
      { id: "loginCustomerId", label: "Login Customer ID", type: "string", section: "metadata" },
    ],
  },
  {
    key: "meta-ads",
    label: "Meta Ads API",
    category: "Advertising",
    channelType: "ads",
    fields: [
      { id: "appId", label: "App ID", type: "string", required: true, section: "credentials" },
      { id: "appSecret", label: "App Secret", type: "password", required: true, section: "credentials" },
      { id: "accessToken", label: "Access Token", type: "password", required: true, section: "credentials" },
      { id: "adAccountId", label: "Ad Account ID", type: "string", required: true, section: "metadata", helpText: "act_XXX" },
      { id: "businessId", label: "Business ID", type: "string", section: "metadata" },
    ],
  },
  {
    key: "tiktok-ads",
    label: "TikTok Ads API",
    category: "Advertising",
    channelType: "ads",
    fields: [
      { id: "accessToken", label: "Access Token", type: "password", required: true, section: "credentials" },
      { id: "advertiserId", label: "Advertiser ID", type: "string", required: true, section: "metadata" },
      { id: "businessCenterId", label: "Business Center ID", type: "string", section: "metadata" },
    ],
  },
  {
    key: "linkedin-ads",
    label: "LinkedIn Ads API",
    category: "Advertising",
    channelType: "ads",
    fields: [
      { id: "clientId", label: "Client ID", type: "string", required: true, section: "credentials" },
      { id: "clientSecret", label: "Client Secret", type: "password", required: true, section: "credentials" },
      { id: "refreshToken", label: "Refresh Token", type: "password", required: true, section: "credentials" },
      { id: "accountId", label: "Account ID", type: "string", required: true, section: "metadata" },
    ],
  },
  {
    key: "snapchat-ads",
    label: "Snapchat Ads API",
    category: "Advertising",
    channelType: "ads",
    fields: [
      { id: "clientId", label: "Client ID", type: "string", required: true, section: "credentials" },
      { id: "clientSecret", label: "Client Secret", type: "password", required: true, section: "credentials" },
      { id: "refreshToken", label: "Refresh Token", type: "password", required: true, section: "credentials" },
      { id: "adAccountId", label: "Ad Account ID", type: "string", required: true, section: "metadata" },
    ],
  },
  {
    key: "twitter-ads",
    label: "Twitter/X Ads API",
    category: "Advertising",
    channelType: "ads",
    fields: [
      { id: "apiKey", label: "API Key", type: "string", required: true, section: "credentials" },
      { id: "apiSecret", label: "API Secret", type: "password", required: true, section: "credentials" },
      { id: "accessToken", label: "Access Token", type: "password", required: true, section: "credentials" },
      { id: "accessTokenSecret", label: "Access Token Secret", type: "password", required: true, section: "credentials" },
      { id: "accountId", label: "Account ID", type: "string", required: true, section: "metadata" },
    ],
  },

  // Analytics
  {
    key: "ga4",
    label: "Google Analytics 4",
    category: "Analytics",
    channelType: "analytics",
    fields: [
      {
        id: "serviceAccountKeyJson",
        label: "Service Account Key JSON",
        type: "password",
        required: true,
        section: "credentials",
        helpText: "Full service account JSON",
      },
      { id: "propertyId", label: "Property ID", type: "string", required: true, section: "metadata" },
      { id: "measurementId", label: "Measurement ID", type: "string", section: "metadata" },
      { id: "apiBaseUrl", label: "API Base URL", type: "url", section: "metadata" },
    ],
  },
  {
    key: "gtm",
    label: "Google Tag Manager",
    category: "Analytics",
    channelType: "analytics",
    fields: [
      { id: "apiKey", label: "API Key", type: "password", required: true, section: "credentials" },
      { id: "accountId", label: "Account ID", type: "string", required: true, section: "metadata" },
      { id: "containerId", label: "Container ID", type: "string", required: true, section: "metadata" },
    ],
  },
  {
    key: "meta-pixel",
    label: "Meta Pixel + CAPI",
    category: "Analytics",
    channelType: "analytics",
    fields: [
      { id: "accessToken", label: "Access Token", type: "password", required: true, section: "credentials" },
      { id: "pixelId", label: "Pixel ID", type: "string", required: true, section: "metadata" },
      { id: "testEventCode", label: "Test Event Code", type: "string", section: "metadata" },
    ],
  },
  {
    key: "search-console",
    label: "Google Search Console",
    category: "Analytics",
    channelType: "analytics",
    fields: [
      { id: "serviceAccountKeyJson", label: "Service Account Key JSON", type: "password", required: true, section: "credentials" },
      { id: "siteUrl", label: "Site URL", type: "url", required: true, section: "metadata" },
    ],
  },
  {
    key: "firebase-analytics",
    label: "Firebase Analytics",
    category: "Analytics",
    channelType: "analytics",
    fields: [
      { id: "serviceAccountKeyJson", label: "Service Account Key JSON", type: "password", required: true, section: "credentials" },
      { id: "projectId", label: "Project ID", type: "string", required: true, section: "metadata" },
      { id: "apiKey", label: "API Key", type: "string", section: "metadata" },
    ],
  },
  {
    key: "mixpanel",
    label: "Mixpanel",
    category: "Analytics",
    channelType: "analytics",
    fields: [
      { id: "projectToken", label: "Project Token", type: "string", required: true, section: "credentials" },
      { id: "apiSecret", label: "API Secret", type: "password", required: true, section: "credentials" },
    ],
  },
  {
    key: "amplitude",
    label: "Amplitude",
    category: "Analytics",
    channelType: "analytics",
    fields: [
      { id: "apiKey", label: "API Key", type: "string", required: true, section: "credentials" },
      { id: "secretKey", label: "Secret Key", type: "password", required: true, section: "credentials" },
    ],
  },

  // Social
  {
    key: "meta-graph",
    label: "Meta Graph API",
    category: "Social",
    channelType: "social",
    fields: [
      { id: "appId", label: "App ID", type: "string", required: true, section: "credentials" },
      { id: "appSecret", label: "App Secret", type: "password", required: true, section: "credentials" },
      { id: "accessToken", label: "Access Token", type: "password", required: true, section: "credentials" },
      { id: "pageId", label: "Page ID", type: "string", section: "metadata" },
      { id: "instagramBusinessId", label: "Instagram Business ID", type: "string", section: "metadata" },
    ],
  },
  {
    key: "tiktok-api",
    label: "TikTok API",
    category: "Social",
    channelType: "social",
    fields: [
      { id: "appId", label: "App ID", type: "string", required: true, section: "credentials" },
      { id: "appSecret", label: "App Secret", type: "password", required: true, section: "credentials" },
      { id: "accessToken", label: "Access Token", type: "password", required: true, section: "credentials" },
      { id: "advertiserOrBusinessId", label: "Advertiser/Business ID", type: "string", section: "metadata" },
    ],
  },
  {
    key: "youtube-data",
    label: "YouTube Data API",
    category: "Social",
    channelType: "social",
    fields: [
      { id: "apiKey", label: "API Key", type: "string", required: true, section: "credentials" },
      { id: "clientId", label: "Client ID", type: "string", section: "credentials" },
      { id: "clientSecret", label: "Client Secret", type: "password", section: "credentials" },
      { id: "refreshToken", label: "Refresh Token", type: "password", section: "credentials" },
      { id: "channelId", label: "Channel ID", type: "string", section: "metadata" },
    ],
  },
  {
    key: "linkedin-api",
    label: "LinkedIn API",
    category: "Social",
    channelType: "social",
    fields: [
      { id: "clientId", label: "Client ID", type: "string", required: true, section: "credentials" },
      { id: "clientSecret", label: "Client Secret", type: "password", required: true, section: "credentials" },
      { id: "refreshToken", label: "Refresh Token", type: "password", required: true, section: "credentials" },
      { id: "organizationId", label: "Organization ID", type: "string", section: "metadata" },
    ],
  },
  {
    key: "twitter-api",
    label: "Twitter/X API",
    category: "Social",
    channelType: "social",
    fields: [
      { id: "apiKey", label: "API Key", type: "string", required: true, section: "credentials" },
      { id: "apiSecret", label: "API Secret", type: "password", required: true, section: "credentials" },
      { id: "accessToken", label: "Access Token", type: "password", required: true, section: "credentials" },
      { id: "accessTokenSecret", label: "Access Token Secret", type: "password", required: true, section: "credentials" },
    ],
  },
  {
    key: "pinterest-api",
    label: "Pinterest API",
    category: "Social",
    channelType: "social",
    fields: [
      { id: "accessToken", label: "Access Token", type: "password", required: true, section: "credentials" },
      { id: "adAccountIdOrUserId", label: "Ad Account ID / User ID", type: "string", section: "metadata" },
    ],
  },

  // Email
  {
    key: "smtp",
    label: "SMTP",
    category: "Email",
    channelType: "email",
    fields: [
      { id: "host", label: "Host", type: "string", required: true, section: "credentials" },
      { id: "port", label: "Port", type: "number", required: true, section: "credentials" },
      { id: "username", label: "Username", type: "string", required: true, section: "credentials" },
      { id: "password", label: "Password", type: "password", required: true, section: "credentials" },
      { id: "useTls", label: "Use TLS", type: "boolean", section: "credentials" },
      { id: "defaultFromEmail", label: "Default From Email", type: "email", required: true, section: "metadata" },
      { id: "defaultFromName", label: "Default From Name", type: "string", section: "metadata" },
    ],
  },
  {
    key: "sendgrid",
    label: "SendGrid",
    category: "Email",
    channelType: "email",
    fields: [
      { id: "apiKey", label: "API Key", type: "password", required: true, section: "credentials" },
      { id: "defaultFromEmail", label: "Default From Email", type: "email", required: true, section: "metadata" },
      { id: "defaultFromName", label: "Default From Name", type: "string", section: "metadata" },
    ],
  },
  {
    key: "mailgun",
    label: "Mailgun",
    category: "Email",
    channelType: "email",
    fields: [
      { id: "apiKey", label: "API Key", type: "password", required: true, section: "credentials" },
      { id: "domain", label: "Domain", type: "string", required: true, section: "credentials" },
      { id: "defaultFromEmail", label: "Default From Email", type: "email", required: true, section: "metadata" },
      { id: "defaultFromName", label: "Default From Name", type: "string", section: "metadata" },
    ],
  },
  {
    key: "ses",
    label: "Amazon SES",
    category: "Email",
    channelType: "email",
    fields: [
      { id: "accessKeyId", label: "Access Key ID", type: "string", required: true, section: "credentials" },
      { id: "secretAccessKey", label: "Secret Access Key", type: "password", required: true, section: "credentials" },
      { id: "region", label: "Region", type: "string", required: true, section: "credentials" },
      { id: "defaultFromEmail", label: "Default From Email", type: "email", required: true, section: "metadata" },
      { id: "defaultFromName", label: "Default From Name", type: "string", section: "metadata" },
    ],
  },
  {
    key: "postmark",
    label: "Postmark",
    category: "Email",
    channelType: "email",
    fields: [
      { id: "serverToken", label: "Server Token", type: "password", required: true, section: "credentials" },
      { id: "defaultFromEmail", label: "Default From Email", type: "email", required: true, section: "metadata" },
      { id: "defaultFromName", label: "Default From Name", type: "string", section: "metadata" },
    ],
  },

  // Messaging (SMS/WhatsApp/Generic)
  {
    key: "twilio-sms",
    label: "Twilio SMS / Voice",
    category: "Messaging",
    channelType: "sms",
    fields: [
      { id: "accountSid", label: "Account SID", type: "string", required: true, section: "credentials" },
      { id: "authToken", label: "Auth Token", type: "password", required: true, section: "credentials" },
      { id: "defaultFromNumber", label: "Default From Number", type: "string", required: true, section: "metadata" },
      { id: "apiBaseUrl", label: "API Base URL", type: "url", section: "metadata" },
    ],
  },
  {
    key: "whatsapp-cloud",
    label: "WhatsApp Cloud API",
    category: "Messaging",
    channelType: "whatsapp",
    fields: [
      { id: "accessToken", label: "Access Token", type: "password", required: true, section: "credentials" },
      { id: "phoneNumberId", label: "Phone Number ID", type: "string", required: true, section: "metadata" },
      { id: "businessAccountId", label: "Business Account ID", type: "string", required: true, section: "metadata" },
    ],
  },
  {
    key: "vonage-sms",
    label: "Vonage SMS/Voice",
    category: "Messaging",
    channelType: "sms",
    fields: [
      { id: "apiKey", label: "API Key", type: "string", required: true, section: "credentials" },
      { id: "apiSecret", label: "API Secret", type: "password", required: true, section: "credentials" },
      { id: "defaultFromNumber", label: "Default From Number", type: "string", section: "metadata" },
    ],
  },
  {
    key: "regional-sms",
    label: "Regional SMS (GupShup / MessageBird / Kaleyra)",
    category: "Messaging",
    channelType: "sms",
    fields: [
      { id: "apiKey", label: "API Key", type: "password", required: true, section: "credentials" },
      {
        id: "providerName",
        label: "Provider Name",
        type: "string",
        section: "metadata",
        helpText: "GupShup / MessageBird / Kaleyra",
      },
      { id: "defaultFromNumber", label: "Default From Number", type: "string", section: "metadata" },
    ],
  },
  {
    key: "custom",
    label: "Custom / Other",
    category: "Messaging",
    channelType: "messaging",
    fields: [],
  },
];

export function getChannelProviderTemplate(
  key: string
): ChannelProviderTemplate | undefined {
  return CHANNEL_PROVIDER_TEMPLATES.find((t) => t.key === key);
}

export function getChannelProviderOptionsByCategory(
  category: ChannelCategory
): { value: string; label: string }[] {
  return CHANNEL_PROVIDER_TEMPLATES.filter((t) => t.category === category).map((t) => ({
    value: t.key,
    label: t.label,
  }));
}
