import type { QueryParams } from './client';

/**
 * Redmine's query-filter syntax: `f[]=<field>&op[<field>]=<op>&v[<field>][]=<value>`.
 *
 * This is the only form that composes. Redmine accepts a handful of shorthand
 * parameters too (`assigned_to_id=me`, `project_id=1`), but the two modes do not
 * mix: **as soon as any `f[]` is present, every shorthand filter is silently
 * ignored.** Verified against Redmine 7.0 — `?assigned_to_id=me&f[]=project_id&...`
 * returns every issue in those projects, not just the caller's.
 *
 * Two further behaviours worth knowing, both verified:
 *  - `project_id=1|2` is a **404**, not a multi-project filter; that parameter is
 *    read as a single id or identifier. Multi-project requires `v[project_id][]`.
 *  - Default status scope differs between the modes. Shorthand defaults to open
 *    issues; `f[]` mode defaults to **all** statuses. Always set status
 *    explicitly rather than relying on the default.
 */

export type FilterOperator =
  | '=' // equals any of the values
  | '!' // is none of the values
  | '>=' // on or after (dates/times)
  | '<=' // on or before
  | '><' // between
  | '~' // contains
  | '!~' // does not contain
  | '*' // any value set
  | '!*' // no value set
  | 'o' // open statuses (status_id only)
  | 'c'; // closed statuses (status_id only)

export interface QueryFilter {
  field: string;
  operator: FilterOperator;
  /** Omitted for value-less operators such as `o`, `c`, `*` and `!*`. */
  values?: Array<string | number>;
}

/** Serialize filters into the repeated-key parameters Redmine expects. */
export function toFilterParams(filters: QueryFilter[]): QueryParams {
  if (filters.length === 0) return {};

  const params: QueryParams = { 'f[]': filters.map((filter) => filter.field) };

  for (const filter of filters) {
    params[`op[${filter.field}]`] = filter.operator;
    if (filter.values && filter.values.length > 0) {
      params[`v[${filter.field}][]`] = filter.values;
    }
  }

  return params;
}
