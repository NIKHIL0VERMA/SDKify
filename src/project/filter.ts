import type { Operation, SDKSpec } from "../canonical/types.js";

export interface TagFilterOptions {
  /**
   * When provided, only operations carrying at least one of these tags
   * are generated.
   */
  includeTags?: string[];

  /**
   * Operations carrying any of these tags are skipped.
   */
  excludeTags?: string[];
}

/**
 * Returns a copy of the spec with services narrowed to the operations
 * that match the tag filters. Named types are always preserved because
 * kept operations may still reference them.
 */
export function filterSpecByTags(
  spec: SDKSpec,
  options: TagFilterOptions,
): SDKSpec {
  const includeTags = normalizeTags(options.includeTags);
  const excludeTags = normalizeTags(options.excludeTags);

  if (includeTags.length === 0 && excludeTags.length === 0) {
    return spec;
  }

  const services = spec.services.map((service) => ({
    ...service,
    operations: service.operations.filter((operation) =>
      matchesTagFilter(operation, includeTags, excludeTags),
    ),
  }));

  return {
    ...spec,
    services,
  };
}

function normalizeTags(tags: string[] | undefined): string[] {
  return (tags ?? []).filter((tag) => tag.length > 0);
}

function matchesTagFilter(
  operation: Operation,
  includeTags: string[],
  excludeTags: string[],
): boolean {
  const tags = operation.tags;

  if (
    includeTags.length > 0 &&
    !includeTags.includes(tags[0] ?? "")
  ) {
    return false;
  }

  if (
    excludeTags.length > 0 &&
    excludeTags.every((tag) => tags.includes(tag))
  ) {
    return false;
  }

  return true;
}
