import { StyleSheet } from "@react-pdf/renderer";

/**
 * Shared styles for PDF documents. Built on the default Helvetica family so no
 * font files need to be bundled; currency is printed with its ISO code because
 * Helvetica has no rupee glyph.
 */
export const colors = {
  text: "#111111",
  muted: "#6b7280",
  border: "#e5e7eb",
  accent: "#111111",
  surface: "#f6f7f9",
};

export const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: colors.text,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    lineHeight: 1.4,
  },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  logo: { width: 56, height: 56, objectFit: "contain", marginBottom: 8 },
  businessName: { fontSize: 16, lineHeight: 1.3, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  docTitle: { fontSize: 22, lineHeight: 1.2, fontFamily: "Helvetica-Bold", textAlign: "right", letterSpacing: 1, marginBottom: 4 },
  label: { fontSize: 7.5, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  value: { fontSize: 9.5 },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: colors.muted },
  row: { flexDirection: "row" },
  spaceBetween: { flexDirection: "row", justifyContent: "space-between" },
  block: { marginBottom: 14 },
  columns: { flexDirection: "row", gap: 24, marginBottom: 20 },
  column: { flex: 1 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginBottom: 20 },
  metaStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
    rowGap: 10,
    backgroundColor: colors.surface,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  metaCell: { minWidth: 96 },
  wordsBox: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 24, marginTop: 8 },
  footerMain: { flex: 1 },
  signatory: { marginTop: 16, width: 200, alignItems: "flex-end" },
  signature: { height: 44, width: 160, objectFit: "contain", marginTop: 6 },
  signatureSpace: { height: 44 },
  signatureLine: { width: 160, borderTopWidth: 1, borderTopColor: colors.text, marginTop: 4, marginBottom: 4 },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 4, marginBottom: 16 },
  tableHeader: { flexDirection: "row", backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border },
  tableRowLast: { flexDirection: "row" },
  th: { paddingVertical: 6, paddingHorizontal: 6, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: colors.muted, textTransform: "uppercase" },
  td: { paddingVertical: 6, paddingHorizontal: 6 },
  right: { textAlign: "right" },
  totals: { marginLeft: "auto", width: 240 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grandTotal: { borderTopWidth: 1, borderTopColor: colors.text, marginTop: 4, paddingTop: 6, fontFamily: "Helvetica-Bold", fontSize: 11 },
  footer: { position: "absolute", left: 40, right: 40, bottom: 24, fontSize: 7.5, color: colors.muted, textAlign: "center" },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: colors.muted, textTransform: "uppercase", marginBottom: 4 },
  badge: { alignSelf: "flex-end", borderWidth: 1, borderColor: colors.border, borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6, fontSize: 8, marginTop: 6 },
});
