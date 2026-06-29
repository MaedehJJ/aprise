import * as Sentry from "@sentry/nextjs";

export type FunnelEvent =
  | "onboarding_complete"
  | "jd_created"
  | "coaching_complete"
  | "resume_generated"
  | "application_created"
  | "interview_prep_started";

export function trackFunnelEvent(
  name: FunnelEvent,
  properties?: Record<string, string | number | boolean>
): void {
  try {
    Sentry.addBreadcrumb({ category: "funnel", message: name, data: properties, level: "info" });
    Sentry.captureMessage(name, { level: "info", tags: properties });
  } catch {
    // Analytics must never throw
  }
}
