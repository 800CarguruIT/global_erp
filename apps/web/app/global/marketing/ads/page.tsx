"use client";

import React from "react";
import { ChannelManager } from "../_components/ChannelManager";

export default function AdsPage() {
  return (
    <ChannelManager
      config={{
        titleKey: "marketing.ads.title",
        descriptionKey: "marketing.ads.desc",
        typeLabelKey: "marketing.ads.type",
        typePluralKey: "marketing.ads.typePlural",
        fields: [
          {
            key: "name",
            labelKey: "marketing.ads.field.name.label",
            placeholderKey: "marketing.ads.field.name.placeholder",
          },
          {
            key: "platform",
            labelKey: "marketing.ads.field.platform.label",
            type: "select",
            options: [
              { value: "meta", labelKey: "marketing.ads.field.platform.options.meta" },
              { value: "google", labelKey: "marketing.ads.field.platform.options.google" },
              { value: "linkedin", labelKey: "marketing.ads.field.platform.options.linkedin" },
              { value: "tiktok", labelKey: "marketing.ads.field.platform.options.tiktok" },
            ],
          },
          {
            key: "budget",
            labelKey: "marketing.ads.field.budget.label",
            placeholderKey: "marketing.ads.field.budget.placeholder",
          },
          {
            key: "bid",
            labelKey: "marketing.ads.field.bid.label",
            placeholderKey: "marketing.ads.field.bid.placeholder",
          },
          {
            key: "tracking",
            labelKey: "marketing.ads.field.tracking.label",
            placeholderKey: "marketing.ads.field.tracking.placeholder",
          },
        ],
        statusKeys: [
          "marketing.status.draft",
          "marketing.status.scheduled",
          "marketing.status.live",
          "marketing.status.paused",
          "marketing.status.completed",
        ],
      }}
    />
  );
}
