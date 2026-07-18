import "@fontsource-variable/inter";
import "../src/styles.css";

export const metadata = {
  title: "Release Truth — Evidence-Gated Launch Decisions",
  description:
    "A release decision workspace that traces product claims to current code, tests, policies, and human approvals.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
