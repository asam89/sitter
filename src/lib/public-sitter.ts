import { SITE_URL } from "@/lib/site";

// A sitter's parent-facing profile is public while she is listed and not
// suspended.
export function isShareable(sp: {
  isListed: boolean;
  user: { suspended: boolean };
}): boolean {
  return sp.isListed && !sp.user.suspended;
}

export function sitterSharePath(profileId: string): string {
  return `/sitters/${profileId}`;
}

export function sitterShareUrl(profileId: string): string {
  return `${SITE_URL}${sitterSharePath(profileId)}`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
