"use client";

import React from "react";
import { ChannelManager } from "../../../../global/marketing/_components/ChannelManager";

export default function CompanyCampaignsPage() {
  return (
    <ChannelManager
      config={{
        titleKey: "marketing.campaigns.title",
        descriptionKey: "marketing.campaigns.desc",
        typeLabelKey: "marketing.campaigns.type",
        typePluralKey: "marketing.campaigns.typePlural",
        mode: "manager",
        itemsApi: "campaigns",
        hideForm: true,
        builder: {
          titleKey: "marketing.campaigns.builder.title",
          descriptionKey: "marketing.campaigns.builder.desc",
          nodes: [
            {
              key: "start",
              labelKey: "marketing.campaigns.builder.node.start",
              descriptionKey: "marketing.campaigns.builder.node.start.desc",
              outputs: 1,
              x: 60,
              y: 90,
            },
            {
              key: "audience",
              labelKey: "marketing.campaigns.builder.node.audience",
              descriptionKey: "marketing.campaigns.builder.node.audience.desc",
              inputs: 1,
              outputs: 1,
              x: 260,
              y: 60,
            },
            {
              key: "channel",
              labelKey: "marketing.campaigns.builder.node.channel",
              descriptionKey: "marketing.campaigns.builder.node.channel.desc",
              inputs: 1,
              outputs: 1,
              x: 470,
              y: 90,
            },
            {
              key: "content",
              labelKey: "marketing.campaigns.builder.node.content",
              descriptionKey: "marketing.campaigns.builder.node.content.desc",
              inputs: 1,
              outputs: 1,
              x: 680,
              y: 60,
            },
            {
              key: "launch",
              labelKey: "marketing.campaigns.builder.node.launch",
              descriptionKey: "marketing.campaigns.builder.node.launch.desc",
              inputs: 1,
              outputs: 0,
              x: 900,
              y: 90,
            },
          ],
          connections: [
            { from: "start", to: "audience" },
            { from: "audience", to: "channel" },
            { from: "channel", to: "content" },
            { from: "content", to: "launch" },
          ],
          palette: [
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
          ],
        },
        fields: [
          {
            key: "companyId",
            labelKey: "marketing.campaigns.field.company.label",
          },
          {
            key: "name",
            labelKey: "marketing.campaigns.field.name.label",
            placeholderKey: "marketing.campaigns.field.name.placeholder",
          },
          {
            key: "startsAt",
            labelKey: "marketing.campaigns.builder.settings.wait.datetime.label",
            type: "datetime",
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
