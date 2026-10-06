/** Inline styles shared by every transactional email template. */
export const emailStyles = {
  body: { backgroundColor: "#f4f4f5", fontFamily: "Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" },
  container: { backgroundColor: "#ffffff", borderRadius: 14, margin: "0 auto", maxWidth: 560, padding: "32px" },
  heading: { fontSize: 20, fontWeight: 600, margin: "0 0 8px" },
  text: { color: "#3f3f46", fontSize: 14, lineHeight: "22px", margin: "0 0 12px" },
  label: { color: "#71717a", fontSize: 12, margin: "0 0 2px", textTransform: "uppercase" as const, letterSpacing: 0.5 },
  value: { fontSize: 14, fontWeight: 600, margin: "0 0 12px" },
  button: { backgroundColor: "#18181b", borderRadius: 10, color: "#ffffff", fontSize: 14, padding: "12px 20px", textDecoration: "none" },
  hr: { borderColor: "#e4e4e7", margin: "20px 0" },
  footer: { color: "#a1a1aa", fontSize: 12, margin: 0 },
  pre: { whiteSpace: "pre-wrap" as const, color: "#3f3f46", fontSize: 13, lineHeight: "20px" },
};
