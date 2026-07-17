import type { AuthorizationContext } from "./types";

export function canViewBusiness(
  context: AuthorizationContext,
  businessId: string,
) {
  if (context.role === "chamber_admin" || context.role === "analyst")
    return true;
  return (
    context.role === "business_member" && context.businessId === businessId
  );
}

export function canEditBusiness(
  context: AuthorizationContext,
  businessId: string,
) {
  if (context.role === "chamber_admin") return true;
  return (
    context.role === "business_member" && context.businessId === businessId
  );
}

export function canManageAccess(context: AuthorizationContext) {
  return context.role === "chamber_admin";
}

export function assertBusinessAccess(
  context: AuthorizationContext,
  businessId: string,
) {
  if (!canViewBusiness(context, businessId)) {
    throw new Error("Business access denied");
  }
}
