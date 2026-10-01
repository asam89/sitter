import { SITE_URL } from "@/lib/site";

// A sitter's parent-facing profile is public only while she is listed, not
// suspended, and has agreed to share her photo and bio.
export function isShareable(sp: {
  isListed: boolean;
  publicOptIn: boolean;
  user: { suspended: boolean };
}): boolean {
  return sp.isListed && sp.publicOptIn && !sp.user.suspended;
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
