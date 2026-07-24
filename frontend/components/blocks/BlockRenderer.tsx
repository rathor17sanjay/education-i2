import type { Block } from "@/lib/blocks";
import DescriptionList from "./DescriptionList";
import StatGrid from "./StatGrid";
import ComparisonTable from "./ComparisonTable";
import FaqAccordion from "./FaqAccordion";

// 1:1 with the AI's block_type -- if a response fails to match one of these,
// it fails schema validation upstream and never reaches the frontend as
// free text (per CLAUDE.md: never render raw model output directly).
export default function BlockRenderer({ block }: { block: Block }) {
  switch (block.block_type) {
    case "description_list":
      return <DescriptionList block={block} />;
    case "stat_grid":
      return <StatGrid block={block} />;
    case "comparison_table":
      return <ComparisonTable block={block} />;
    case "faq_accordion":
      return <FaqAccordion block={block} />;
  }
}
