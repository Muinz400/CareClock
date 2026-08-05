"use client";

import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { tokens } from "../../styles/tokens";

/**
 * Foundation components only — not yet adopted by any existing page.
 * Real <table>/<thead>/<tbody>/<tr>/<th>/<td> elements throughout, targeting
 * the audit finding that some of the densest data screens today use
 * unaligned <div> rows instead of a real, screen-reader-friendly table.
 */

export function TableWrapper({ style, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        overflowX: "auto",
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radius.lg,
        background: tokens.colors.surface,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Table({ style, children, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontFamily: tokens.typography.fontFamily,
        fontSize: tokens.typography.size.base,
        ...style,
      }}
      {...rest}
    >
      {children}
    </table>
  );
}

export function TableHead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TableRow(props: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} />;
}

export function TableHeaderCell({
  style,
  children,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
        borderBottom: `1px solid ${tokens.colors.border}`,
        background: tokens.colors.surfaceMuted,
        fontWeight: tokens.typography.weight.semibold,
        fontSize: tokens.typography.size.xs,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: tokens.colors.inkMuted,
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TableCell({ style, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      style={{
        padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
        borderBottom: `1px solid ${tokens.colors.borderMuted}`,
        fontSize: tokens.typography.size.base,
        verticalAlign: "top",
        ...style,
      }}
      {...rest}
    >
      {children}
    </td>
  );
}

const TableNamespace = Object.assign(Table, {
  Wrapper: TableWrapper,
  Head: TableHead,
  Body: TableBody,
  Row: TableRow,
  HeaderCell: TableHeaderCell,
  Cell: TableCell,
});

export default TableNamespace;
