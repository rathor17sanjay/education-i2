// Mirrors backend/rag/blocks.py's RESPONSE_TOOL schema -- keep in sync.

export type DescriptionListBlock = {
  block_type: "description_list";
  heading: string;
  body: string;
  bullets: string[];
};

export type StatGridBlock = {
  block_type: "stat_grid";
  stats: { value: string; label: string }[];
};

export type ComparisonTableBlock = {
  block_type: "comparison_table";
  headers: string[];
  rows: string[][];
};

export type FaqAccordionBlock = {
  block_type: "faq_accordion";
  items: { question: string; answer: string }[];
};

export type Block =
  | DescriptionListBlock
  | StatGridBlock
  | ComparisonTableBlock
  | FaqAccordionBlock;

export type QueryResponse = {
  title: string;
  subtitle: string;
  blocks: Block[];
  follow_up_chips: string[];
  insufficient_context: boolean;
  grounded: boolean;
};
