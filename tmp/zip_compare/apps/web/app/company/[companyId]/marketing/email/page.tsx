"use client";

import React from "react";
import { ChannelManager } from "../../../../global/marketing/_components/ChannelManager";

export default function CompanyEmailPage() {
  return (
    <ChannelManager
      config={{
        titleKey: "marketing.email.title",
        descriptionKey: "marketing.email.desc",
        typeLabelKey: "marketing.email.type",
        typePluralKey: "marketing.email.typePlural",
        fields: [
          {
            key: "subject",
            labelKey: "marketing.email.field.subject.label",
            placeholderKey: "marketing.email.field.subject.placeholder",
          },
          {
            key: "template",
            labelKey: "marketing.email.field.template.label",
            placeholderKey: "marketing.email.field.template.placeholder",
          },
          {
            key: "audience",
            labelKey: "marketing.email.field.audience.label",
            placeholderKey: "marketing.email.field.audience.placeholder",
          },
          {
            key: "from",
            labelKey: "marketing.email.field.from.label",
            placeholderKey: "marketing.email.field.from.placeholder",
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
