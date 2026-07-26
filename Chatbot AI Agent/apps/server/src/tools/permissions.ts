/** Tool permission helpers — backend enforcement beyond AI prompts. */

export function canMutateOrder(input: {
  verifiedOrderId?: string | null;
  targetOrderId?: string;
}): { allowed: boolean; reason?: string } {
  if (!input.verifiedOrderId) {
    return { allowed: false, reason: "Order ownership not verified" };
  }
  if (input.targetOrderId && input.targetOrderId !== input.verifiedOrderId) {
    return { allowed: false, reason: "Order id does not match verified order" };
  }
  return { allowed: true };
}

export function assertWorkspace(workspaceId: string, expected: string) {
  if (workspaceId !== expected) {
    throw new Error("Workspace mismatch");
  }
}
