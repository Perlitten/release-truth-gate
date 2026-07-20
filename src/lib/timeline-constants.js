import {
  ClipboardText,
  BracketsCurly,
  Flask,
  Scales,
  CheckCircle,
  XCircle,
  ClockCounterClockwise,
} from "@phosphor-icons/react";

export const TIMELINE_LANES = [
  { id: "claim", label: "Claim", hint: "What we promise", icon: ClipboardText },
  { id: "code", label: "Code", hint: "What we ship", icon: BracketsCurly },
  { id: "test", label: "Tests", hint: "What we verify", icon: Flask },
  { id: "decision", label: "Decisions", hint: "Who decides", icon: Scales },
];

export const TIMELINE_STATUS = {
  verified: { label: "Verified", icon: CheckCircle },
  contradicted: { label: "Contradicted", icon: XCircle },
  pending: { label: "Pending", icon: ClockCounterClockwise },
};

export const LANE_TO_FOCUS = { claim: "claim", code: "code", test: "tests", decision: "decisions" };
