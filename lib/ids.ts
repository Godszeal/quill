import { randomUUID } from "crypto";

export function nid() {
  return randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}
