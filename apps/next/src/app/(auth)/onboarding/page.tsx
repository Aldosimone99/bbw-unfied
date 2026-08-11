import { redirect } from "next/navigation";

export default function OnboardingPage() {
  // bbw-transition completes registration before creating the session. The
  // landing UI keeps this legacy path only as a safe compatibility redirect.
  redirect("/dashboard");
}
