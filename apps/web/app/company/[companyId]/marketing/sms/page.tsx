"use client";

import React from "react";
import { ChannelManager } from "../../../../global/marketing/_components/ChannelManager";

export default function CompanySmsPage() {
  return (
    <ChannelManager
      config={{
        titleKey: "marketing.sms.title",
        descriptionKey: "marketing.sms.desc",
        typeLabelKey: "marketing.sms.type",
        typePluralKey: "marketing.sms.typePlural",
        fields: [
          { key: "name", labelKey: "marketing.sms.field.name.label", placeholderKey: "marketing.sms.field.name.placeholder" },
          {
            key: "senderId",
            labelKey: "marketing.sms.field.senderId.label",
            placeholderKey: "marketing.sms.field.senderId.placeholder",
          },
          {
            key: "audience",
            labelKey: "marketing.sms.field.audience.label",
            placeholderKey: "marketing.sms.field.audience.placeholder",
          },
          {
            key: "message",
            labelKey: "marketing.sms.field.message.label",
            type: "textarea",
            placeholderKey: "marketing.sms.field.message.placeholder",
          },
        ],
        statusKeys: [
          "marketing.status.draft",
          "marketing.status.scheduled",
          "marketing.status.sending",
          "marketing.status.paused",
          "marketing.status.completed",
        ],
      }}
    />
  );
}
