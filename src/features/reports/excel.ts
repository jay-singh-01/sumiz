/*
 * Excel export of the summary: one workbook, one sheet per report, using the
 * current filters. The library loads only when she taps "Excel".
 */
import { download, safeFileName } from '@/features/bills/exporter'

export type Cell = string | number | null

export interface Sheet {
  name: string
  header: string[]
  rows: Cell[][]
  /** Column widths in characters (optional). */
  widths?: number[]
}

/** Excel forbids [ ] / \ : * ? in sheet names and allows at most 31 characters. */
export function sheetName(name: string): string {
  return name.replace(/[[\]/\\:*?]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sheet'
}

export async function downloadWorkbook(fileBase: string, sheets: Sheet[]): Promise<void> {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const payload = sheets.map((s) => ({
    sheet: sheetName(s.name),
    stickyRowsCount: 1,
    columns: (s.widths ?? s.header.map((h) => Math.max(12, h.length + 4))).map((width) => ({ width })),
    data: [
      s.header.map((h) => ({ value: h, fontWeight: 'bold' as const })),
      ...s.rows.map((row) => row.map((v) => (v === null ? null : { value: v }))),
    ],
  }))
  const blob = await writeExcelFile(payload as never).toBlob()
  download(blob, `${safeFileName(fileBase)}.xlsx`)
}
