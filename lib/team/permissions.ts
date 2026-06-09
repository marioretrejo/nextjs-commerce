export const ROLE_WEIGHT: Record<string, number> = {
  superadmin: 100,
  owner: 80,
  admin: 50,
  editor: 20,
  viewer: 10,
};

export const ALL_MODULES = [
  "dashboard",
  "agents",
  "campaigns",
  "calls",
  "analytics",
  "knowledge",
  "quality",
  "numbers",
  "compliance",
  "integrations",
  "team",
  "billing",
  "settings",
  "developers",
] as const;

export type ModuleKey = (typeof ALL_MODULES)[number];

export function canManage(actorWeight: number, targetWeight: number): boolean {
  return actorWeight > targetWeight;
}
