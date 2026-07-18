export type Status = "Active" | "Review" | "Blocked" | "Done";
export type Row = { id: number; version: number; task: string; owner: string; status: Status; priority: number; due: string; budget: number };
export type Key = keyof Omit<Row, "id" | "version">;
export type EditState = { id: number; key: Key; value: string };
export type Column = { key: Key; label: string; width: number };
export const statuses: Status[] = ["Active", "Review", "Blocked", "Done"];
export const statusLabels: Record<Status, string> = { Active: "进行中", Review: "待审核", Blocked: "已阻塞", Done: "已完成" };
