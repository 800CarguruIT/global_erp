"use client";

import React from "react";
import { ChannelManager } from "../_components/ChannelManager";

export default function PostsPage() {
  return (
    <ChannelManager
      config={{
        titleKey: "marketing.posts.title",
        descriptionKey: "marketing.posts.desc",
        typeLabelKey: "marketing.posts.type",
        typePluralKey: "marketing.posts.typePlural",
        fields: [
          { key: "title", labelKey: "marketing.posts.field.title.label", placeholderKey: "marketing.posts.field.title.placeholder" },
          {
            key: "platform",
            labelKey: "marketing.posts.field.platform.label",
            type: "select",
            options: [
              { value: "facebook", labelKey: "marketing.posts.field.platform.options.facebook" },
              { value: "instagram", labelKey: "marketing.posts.field.platform.options.instagram" },
              { value: "linkedin", labelKey: "marketing.posts.field.platform.options.linkedin" },
              { value: "x", labelKey: "marketing.posts.field.platform.options.x" },
            ],
          },
          {
            key: "audience",
            labelKey: "marketing.posts.field.audience.label",
            placeholderKey: "marketing.posts.field.audience.placeholder",
          },
          {
            key: "asset",
            labelKey: "marketing.posts.field.asset.label",
            placeholderKey: "marketing.posts.field.asset.placeholder",
          },
          {
            key: "caption",
            labelKey: "marketing.posts.field.caption.label",
            type: "textarea",
            placeholderKey: "marketing.posts.field.caption.placeholder",
          },
        ],
        statusKeys: [
          "marketing.status.draft",
          "marketing.status.scheduled",
          "marketing.status.published",
          "marketing.status.paused",
        ],
      }}
    />
  );
}
