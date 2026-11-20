import type { DocumentType } from '@/lib/types';

export const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'report', label: 'Report' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'brief', label: 'Campaign brief' },
  { value: 'job_description', label: 'Job description' },
  { value: 'research', label: 'Research' },
  { value: 'meeting_summary', label: 'Meeting summary' },
  { value: 'writing', label: 'Professional writing' },
  { value: 'other', label: 'Other' },
];

export const docTypeLabel = (t: DocumentType) => DOC_TYPES.find((d) => d.value === t)?.label ?? 'Document';

/** Starter outlines. They're plain Markdown — edit freely. */
export const DOC_TEMPLATES: Record<DocumentType, string> = {
  report: '# Report title\n\n## Summary\nThree sentences: what happened, what it means, what next.\n\n## Key results\n- \n\n## Details\n\n## Recommendations\n1. \n\n## Next steps\n',
  proposal: '# Proposal\n\n## The problem\n\n## Proposed approach\n\n## Scope & deliverables\n- \n\n## Timeline\n| Phase | Dates |\n|---|---|\n|  |  |\n\n## Budget\n\n## Why this matters\n',
  strategy: '# Strategy\n\n## Context\n\n## Goals\n1. \n\n## Audience\n\n## Pillars\n### Pillar one\n\n## Channels\n\n## Measures of success\n\n## Risks\n',
  brief: '# Campaign brief\n\n## Background\n\n## Objectives\n- \n\n## Audience\n\n## Key messages\n- \n\n## Deliverables\n- [ ] \n\n## Timeline\n\n## Budget\n\n## Approvals\n',
  job_description: '# Job title\n\n## About the role\n\n## Responsibilities\n- \n\n## What you bring\n- \n\n## Nice to have\n- \n\n## What we offer\n- \n',
  research: '# Research: topic\n\n## Question\n\n## Method & sources\n\n## Findings\n1. \n\n## Implications\n\n## References\n- \n',
  meeting_summary: '# Meeting summary\n\n**Date:**  \n**Attendees:**  \n\n## Agenda\n1. \n\n## Discussion\n\n## Decisions\n- \n\n## Action items\n- [ ] \n',
  writing: '# Title\n\n',
  other: '',
};
