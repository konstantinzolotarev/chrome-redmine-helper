/**
 * Shapes returned by the Redmine REST API.
 *
 * Hand-written rather than generated: Redmine ships no OpenAPI spec, and the
 * responses vary by `include=` parameter and by the caller's permissions.
 * Fields that are only present under some conditions are marked optional.
 *
 * Verified against Redmine 5.x–7.x, which are wire-compatible for everything
 * used here.
 */

/** The `{id, name}` pair Redmine returns for most associations. */
export interface IdName {
  id: number;
  name: string;
}

export interface CustomFieldValue {
  id: number;
  name: string;
  /** Multi-valued custom fields return an array. */
  value: string | string[] | null;
  multiple?: boolean;
}

export interface JournalDetail {
  /** `attr` = built-in field, `cf` = custom field, plus attachment/relation. */
  property: 'attr' | 'cf' | 'attachment' | 'relation' | string;
  /** Field name for `attr` (e.g. `status_id`), or the numeric id for `cf`. */
  name: string;
  old_value: string | null;
  new_value: string | null;
}

export interface Journal {
  id: number;
  user: IdName;
  notes: string;
  created_on: string;
  updated_on?: string;
  private_notes?: boolean;
  details: JournalDetail[];
}

export interface Attachment {
  id: number;
  filename: string;
  filesize: number;
  content_type: string | null;
  description: string | null;
  content_url: string;
  thumbnail_url?: string;
  author: IdName;
  created_on: string;
}

export interface IssueRelation {
  id: number;
  issue_id: number;
  issue_to_id: number;
  relation_type: string;
  delay: number | null;
}

export interface Issue {
  id: number;
  project: IdName;
  tracker: IdName;
  status: IdName;
  priority: IdName;
  author: IdName;
  assigned_to?: IdName;
  category?: IdName;
  fixed_version?: IdName;
  parent?: { id: number };
  subject: string;
  description: string | null;
  start_date?: string | null;
  due_date?: string | null;
  done_ratio: number;
  is_private?: boolean;
  estimated_hours?: number | null;
  total_estimated_hours?: number | null;
  spent_hours?: number;
  total_spent_hours?: number;
  custom_fields?: CustomFieldValue[];
  created_on: string;
  updated_on: string;
  closed_on?: string | null;

  // Only present with the matching `include=` parameter.
  journals?: Journal[];
  attachments?: Attachment[];
  relations?: IssueRelation[];
  watchers?: IdName[];
}

export interface Project {
  id: number;
  name: string;
  identifier: string;
  description: string | null;
  homepage?: string;
  parent?: IdName;
  status: number;
  is_public?: boolean;
  inherit_members?: boolean;
  created_on: string;
  updated_on: string;

  // Only present with the matching `include=` parameter.
  trackers?: IdName[];
  issue_categories?: IdName[];
  enabled_modules?: IdName[];
}

export interface Membership {
  id: number;
  project: IdName;
  user?: IdName;
  group?: IdName;
  roles: IdName[];
}

export interface User {
  id: number;
  login?: string;
  admin?: boolean;
  firstname: string;
  lastname: string;
  mail?: string;
  created_on?: string;
  updated_on?: string;
  last_login_on?: string | null;
  /** Only returned for the authenticated user, or to admins. */
  api_key?: string;
  status?: number;
}

export interface TimeEntry {
  id: number;
  project: IdName;
  issue?: { id: number };
  user: IdName;
  activity: IdName;
  hours: number;
  comments: string;
  spent_on: string;
  created_on: string;
  updated_on: string;
  custom_fields?: CustomFieldValue[];
}

export interface NewsItem {
  id: number;
  project: IdName;
  author: IdName;
  title: string;
  summary: string;
  description: string;
  created_on: string;
}

export interface IssueStatus extends IdName {
  is_closed?: boolean;
}

export interface Tracker extends IdName {
  default_status?: IdName;
  description?: string | null;
}

export interface Enumeration extends IdName {
  is_default?: boolean;
  active?: boolean;
}

/** Envelope Redmine wraps every paginated collection in. */
export interface PagedResponse {
  total_count: number;
  offset: number;
  limit: number;
}

export interface UploadToken {
  id?: number;
  token: string;
}

/** Reference to an already-uploaded file, attached when creating/updating an issue. */
export interface UploadRef {
  token: string;
  filename: string;
  content_type?: string;
  description?: string;
}
