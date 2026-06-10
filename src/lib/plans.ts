import type { Plan } from "@prisma/client";

export const FREE_QUOTE_LIMIT = 5;

export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
  crew: "Crew",
};

export function canRemoveBranding(plan: Plan) {
  return plan !== "free";
}

export function canCollectDeposits(plan: Plan) {
  return plan !== "free";
}

export function hasAutoFollowups(plan: Plan) {
  return plan === "crew";
}

export function monthStart(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
