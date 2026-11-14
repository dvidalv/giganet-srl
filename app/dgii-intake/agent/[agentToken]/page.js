import DgiiAgentIntakeView from "@/components/dgii-intake/DgiiAgentIntakeView";

/**
 * Public agent page — NO login / session.
 * Access gated only by valid agentToken in the URL
 * (validated client-side via GET /api/dgii-intake/agent/[agentToken]).
 */
export default async function DgiiAgentPublicPage({ params }) {
  const { agentToken } = await params;
  const token =
    typeof agentToken === "string" && agentToken.length >= 32 ? agentToken : "";

  return <DgiiAgentIntakeView agentToken={token} />;
}
