"use client";

import React from "react";
import { ChannelManager } from "../../../../../global/marketing/_components/ChannelManager";

export default function CompanyCampaignBuilderPage() {
  return (
    <ChannelManager
      config={{
        titleKey: "marketing.campaigns.title",
        descriptionKey: "marketing.campaigns.desc",
        typeLabelKey: "marketing.campaigns.type",
        typePluralKey: "marketing.campaigns.typePlural",
        mode: "builder",
        builder: {
          titleKey: "marketing.campaigns.builder.title",
          descriptionKey: "marketing.campaigns.builder.desc",
          nodes: [],
          connections: [],
          palette: [
            {
              key: "start",
              labelKey: "marketing.campaigns.builder.node.start",
              descriptionKey: "marketing.campaigns.builder.node.start.desc",
              inputs: 0,
              outputs: 1,
            },
            {
              key: "audience",
              labelKey: "marketing.campaigns.builder.node.audience",
              descriptionKey: "marketing.campaigns.builder.node.audience.desc",
              inputs: 1,
              outputs: 1,
            },
            {
              key: "channel",
              labelKey: "marketing.campaigns.builder.node.channel",
              descriptionKey: "marketing.campaigns.builder.node.channel.desc",
              inputs: 1,
              outputs: 1,
            },
            {
              key: "content",
              labelKey: "marketing.campaigns.builder.node.content",
              descriptionKey: "marketing.campaigns.builder.node.content.desc",
              inputs: 1,
              outputs: 1,
            },
            {
              key: "delay",
              labelKey: "marketing.campaigns.builder.node.delay",
              descriptionKey: "marketing.campaigns.builder.node.delay.desc",
              inputs: 1,
              outputs: 1,
            },
            {
              key: "condition",
              labelKey: "marketing.campaigns.builder.node.condition",
              descriptionKey: "marketing.campaigns.builder.node.condition.desc",
              inputs: 1,
              outputs: 2,
            },
            {
              key: "launch",
              labelKey: "marketing.campaigns.builder.node.launch",
              descriptionKey: "marketing.campaigns.builder.node.launch.desc",
              inputs: 1,
              outputs: 0,
            },
            {
              key: "end",
              labelKey: "marketing.campaigns.builder.node.end",
              descriptionKey: "marketing.campaigns.builder.node.end.desc",
              inputs: 1,
              outputs: 0,
            },
          ],
        },
        fields: [
          {
            key: "name",
            labelKey: "marketing.campaigns.field.name.label",
            placeholderKey: "marketing.campaigns.field.name.placeholder",
          },
          {
            key: "objective",
            labelKey: "marketing.campaigns.field.objective.label",
            placeholderKey: "marketing.campaigns.field.objective.placeholder",
          },
          {
            key: "channel",
            labelKey: "marketing.campaigns.field.channel.label",
            type: "select",
            options: [
              { value: "sms", labelKey: "marketing.campaigns.field.channel.options.sms" },
              { value: "email", labelKey: "marketing.campaigns.field.channel.options.email" },
              { value: "whatsapp", labelKey: "marketing.campaigns.field.channel.options.whatsapp" },
              { value: "ads", labelKey: "marketing.campaigns.field.channel.options.ads" },
            ],
          },
          {
            key: "budget",
            labelKey: "marketing.campaigns.field.budget.label",
            placeholderKey: "marketing.campaigns.field.budget.placeholder",
          },
          {
            key: "audience",
            labelKey: "marketing.campaigns.field.audience.label",
            placeholderKey: "marketing.campaigns.field.audience.placeholder",
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
