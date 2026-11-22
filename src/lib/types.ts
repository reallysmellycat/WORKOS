// Central data model for Work OS.
// Every record shares BaseRecord: soft-deletion (deletedAt) powers the Trash,
// isDemo marks optional sample content so it can be removed in one click.

export type ID = string;

export interface BaseRecord {
  id: ID;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
  isDemo?: boolean;
}

export type EntityType =
  | 'task'
  | 'project'
  | 'campaign'
  | 'pressRelease'
  | 'coverage'
  | 'content'
  | 'contentIdea'
  | 'note'
  | 'document'
  | 'idea'
  | 'event'
  | 'kpi'
  | 'bookmark'
  | 'file';

export interface EntityRef {
  type: EntityType;
  id: ID;
}

export type CustomValues = Record<string, string>;

// ---------- Tasks ----------
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'not_started' | 'in_progress' | 'waiting' | 'completed';

export interface ChecklistItem {
  id: ID;
  text: string;
  done: boolean;
}

export interface Recurrence {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
}

export interface Task extends BaseRecord {
  title: string;
  description?: string;
  notes?: string;
  priority: Priority;
  status: TaskStatus;
  startDate?: string | null; // YYYY-MM-DD
  dueDate?: string | null; // YYYY-MM-DD
  completedAt?: number | null;
  parentId?: ID | null; // subtasks are tasks with a parent
  checklist: ChecklistItem[];
  blockedBy: ID[]; // dependencies
  recurrence?: Recurrence | null;
  tags: string[];
  projectId?: ID | null;
  campaignId?: ID | null;
  myDay?: string | null; // YYYY-MM-DD the task was planned for "My Day"
  order: number;
  custom?: CustomValues;
}

// ---------- Projects ----------
export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'completed';

export interface Milestone {
  id: ID;
  title: string;
  date?: string | null;
  done: boolean;
}

export interface LinkItem {
  id: ID;
  title: string;
  url: string;
}

export interface Project extends BaseRecord {
  title: string;
  description?: string;
  objectives?: string;
  status: ProjectStatus;
  startDate?: string | null;
  deadline?: string | null;
  completedAt?: number | null;
  progressMode: 'auto' | 'manual';
  manualProgress: number; // 0-100
  milestones: Milestone[];
  links: LinkItem[];
  notes?: string;
  tags: string[];
  color?: string;
  templateId?: ID | null;
  campaignIds?: ID[];
  custom?: CustomValues;
}

export interface TemplateTask {
  title: string;
  priority: Priority;
  offsetDays?: number | null;
}

export interface TemplateMilestone {
  title: string;
  offsetDays?: number | null;
}

export interface ProjectTemplate extends BaseRecord {
  name: string;
  kind: 'pr' | 'marketing' | 'content' | 'event' | 'general' | 'custom';
  description?: string;
  objectives?: string;
  durationDays?: number | null;
  milestones: TemplateMilestone[];
  tasks: TemplateTask[];
  builtIn?: boolean;
}

// ---------- PR & Campaigns ----------
export type CampaignStatus = 'planning' | 'in_progress' | 'reviewing' | 'completed' | 'archived';

export interface CampaignActivity {
  id: ID;
  title: string;
  date?: string | null;
  done: boolean;
}

export interface Campaign extends BaseRecord {
  name: string;
  description?: string;
  objectives?: string;
  audience?: string;
  keyMessages?: string;
  status: CampaignStatus;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number | null;
  spent?: number | null;
  currency?: string;
  activities: CampaignActivity[];
  mediaLinks: LinkItem[];
  results?: string;
  notes?: string;
  cover?: string | null; // "motif|palette" for generative cover art
  projectId?: ID | null;
  tags: string[];
  custom?: CustomValues;
}

export type PressReleaseStatus = 'idea' | 'drafting' | 'review' | 'approved' | 'distributed';

export interface PressRelease extends BaseRecord {
  title: string;
  campaignId?: ID | null;
  status: PressReleaseStatus;
  body?: string;
  publicationDate?: string | null;
  distributionDate?: string | null;
  platform?: string;
  publishedLinks: LinkItem[];
  results?: string;
}

export interface Coverage extends BaseRecord {
  outlet: string;
  headline: string;
  url?: string;
  date?: string | null;
  reach?: number | null;
  sentiment?: 'positive' | 'neutral' | 'negative' | null;
  campaignId?: ID | null;
  pressReleaseId?: ID | null;
  notes?: string;
}

// ---------- Content Studio ----------
export type ContentStatus = 'idea' | 'drafting' | 'reviewing' | 'scheduled' | 'published';

export interface ContentMetrics {
  reach?: number | null;
  impressions?: number | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  clicks?: number | null;
}

export interface ContentItem extends BaseRecord {
  title: string;
  platform: string;
  contentType: string;
  caption?: string;
  draft?: string;
  publishDate?: string | null; // YYYY-MM-DD
  publishTime?: string | null; // HH:mm
  status: ContentStatus;
  campaignId?: ID | null;
  projectId?: ID | null;
  referenceLinks: LinkItem[];
  metrics: ContentMetrics;
  notes?: string;
  tags: string[];
  custom?: CustomValues;
}

export type ContentIdeaKind = 'hook' | 'post' | 'video' | 'caption' | 'reference' | 'inspiration' | 'note';

export interface ContentIdea extends BaseRecord {
  kind: ContentIdeaKind;
  text: string;
  platform?: string | null;
  url?: string;
  tags: string[];
  convertedTo?: ID | null;
}

export interface SocialSnapshot extends BaseRecord {
  platform: string;
  date: string; // YYYY-MM-DD
  followers?: number | null;
  reach?: number | null;
  impressions?: number | null;
  engagement?: number | null;
  views?: number | null;
  custom?: Record<string, number>;
}

// ---------- Knowledge ----------
export type NoteKind = 'note' | 'research' | 'reference' | 'meeting';

export interface Note extends BaseRecord {
  title: string;
  body: string; // Markdown
  kind: NoteKind;
  folderId?: ID | null;
  category?: string | null;
  tags: string[];
  refs: EntityRef[];
  pinned?: boolean;
}

export type DocumentType =
  | 'report'
  | 'proposal'
  | 'strategy'
  | 'brief'
  | 'job_description'
  | 'research'
  | 'meeting_summary'
  | 'writing'
  | 'other';

export interface Doc extends BaseRecord {
  title: string;
  body: string; // Markdown
  docType: DocumentType;
  status: 'draft' | 'in_review' | 'final';
  folderId?: ID | null;
  tags: string[];
  refs: EntityRef[];
}

export interface Folder extends BaseRecord {
  name: string;
  scope: 'library' | 'documents';
}

export interface Collection extends BaseRecord {
  name: string;
  description?: string;
  items: EntityRef[];
}

export interface Bookmark extends BaseRecord {
  title: string;
  url: string;
  description?: string;
  folderId?: ID | null;
  category?: string | null;
  tags: string[];
  refs: EntityRef[];
}

export interface StoredFile extends BaseRecord {
  name: string;
  mime: string;
  size: number;
  blob: Blob;
  folderId?: ID | null;
  tags: string[];
  // Where the file is attached (optional). Library uploads have no owner.
  owner?: EntityRef | null;
  inline?: boolean; // embedded inside a note/document body
}

// ---------- Ideas ----------
export interface Idea extends BaseRecord {
  text: string;
  details?: string;
  category?: string | null; // only ever set by the user
  status: 'inbox' | 'converted' | 'archived';
  convertedTo?: EntityRef | null;
  tags: string[];
}

// ---------- Calendar ----------
export type EventKind = 'meeting' | 'work_block' | 'reminder' | 'event' | 'deadline';

export interface CalEvent extends BaseRecord {
  title: string;
  kind: EventKind;
  date: string; // YYYY-MM-DD
  startTime?: string | null; // HH:mm (null = all day)
  endTime?: string | null;
  location?: string;
  notes?: string;
  ref?: EntityRef | null;
}

// ---------- Performance ----------
export interface KPI extends BaseRecord {
  name: string;
  description?: string;
  unit?: string;
  target?: number | null;
  period: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  direction: 'up' | 'down'; // is higher better?
  color?: string;
}

export interface KPIEntry extends BaseRecord {
  kpiId: ID;
  date: string; // YYYY-MM-DD
  value: number;
  note?: string;
}

export interface MonthlyReview extends BaseRecord {
  month: string; // YYYY-MM
  reflections?: string;
  wins?: string;
  challenges?: string;
  nextFocus?: string;
  rating?: number | null; // 1-5
}

// ---------- System ----------
export interface Activity {
  id?: number;
  at: number;
  entity: EntityType;
  entityId: ID;
  action: 'created' | 'updated' | 'completed' | 'deleted' | 'restored' | 'converted' | 'status';
  title: string;
  detail?: string;
}

export interface Dismissal {
  key: string; // notification key
  at: number;
}

export interface Snapshot {
  id?: number;
  at: number;
  reason: 'auto' | 'manual' | 'before-import' | 'before-clear';
  data: string; // JSON (files excluded to save space)
  size: number;
}

export interface KV {
  key: string;
  value: unknown;
}

// ---------- AI ----------
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIConversation extends BaseRecord {
  title: string;
  messages: ChatMessage[];
  context: EntityRef[];
}
