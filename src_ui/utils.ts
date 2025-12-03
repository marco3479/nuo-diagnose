import type { Instance } from './types';

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function stateColor(state: string): string {
  const known: Record<string, string> = {
    RUNNING: 'hsl(145 55% 45%)',
    NOT_RUNNING: 'hsl(0 65% 48%)',
    AWAITING_ARCHIVE_HISTORIES_INC: 'hsl(35 85% 55%)',
    AWAITING_ARCHIVE_HISTORIES: 'hsl(35 85% 55%)',
    AWAITING_RESET: 'hsl(20 75% 55%)',
    STARTING: 'hsl(210 70% 55%)',
    STOPPING: 'hsl(355 60% 50%)',
  };
  if (known[state]) return known[state];
  
  // Fallback: hash state to hue
  let h = 0;
  for (let i = 0; i < state.length; i++) {
    h = (h * 31 + state.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue} 60% 48%)`;
}

export function getInstanceType(
  instance: Instance,
  rowsBySid: Record<string, Instance[]>
): string {
  return (
    instance.type ??
    rowsBySid[String(instance.sid)]?.find((x) => x.type)?.type ??
    ''
  );
}

export function calculateProcessColor(
  anyType: string | undefined,
  sidIndexInGroup: number
): { hue: number; sat: number; lit: number } {
  let baseHue = 200; // default gray-blue
  let baseSat = 50;
  let baseLit = 48;

  if (anyType === 'SM') {
    baseHue = 220;
    baseSat = 65;
    baseLit = 50;
  } else if (anyType === 'TE') {
    baseHue = 42;
    baseSat = 82;
    baseLit = 48;
  }

  // Vary hue slightly per sid index in this group
  const hueVariation =
    anyType === 'TE'
      ? ((sidIndexInGroup * 3) % 40) - 7
      : anyType === 'SM'
      ? ((sidIndexInGroup * 15) % 60) - 30
      : 0;

  // Purple if not TE or SM
  if (!anyType || (anyType !== 'TE' && anyType !== 'SM')) {
    baseHue = 280;
    baseSat = 55;
    baseLit = 45;
  }

  const hue = baseHue + hueVariation;
  return { hue, sat: baseSat, lit: baseLit };
}

export function sortInstances<T extends Instance>(
  instances: T[],
  sortKey: 'sid' | 'type' | 'address' | 'start' | 'end',
  sortDir: 'asc' | 'desc',
  getType: (inst: T) => string
): T[] {
  const comparator = (a: T, b: T) => {
    let va: any;
    let vb: any;
    switch (sortKey) {
      case 'sid':
        va = a.sid;
        vb = b.sid;
        break;
      case 'type':
        va = getType(a);
        vb = getType(b);
        break;
      case 'address':
        va = a.address ?? '';
        vb = b.address ?? '';
        break;
      case 'start':
        va = a.start;
        vb = b.start;
        break;
      case 'end':
        va = a.end;
        vb = b.end;
        break;
    }
    if (typeof va === 'string' && typeof vb === 'string') {
      const c = va.localeCompare(vb);
      return sortDir === 'asc' ? c : -c;
    }
    const c = (va ?? 0) - (vb ?? 0);
    return sortDir === 'asc' ? c : -c;
  };
  return instances.slice().sort(comparator);
}

export function groupInstancesByAddress(
  rowsBySid: Record<string, Instance[]>
): Record<string, string[]> {
  const groupsByAddress: Record<string, string[]> = {};
  for (const [sid, insts] of Object.entries(rowsBySid)) {
    const addr = insts[0]?.address ?? 'unknown';
    (groupsByAddress[addr] ||= []).push(sid);
  }
  return groupsByAddress;
}

export function sortAddressesByEarliestStart(
  groupsByAddress: Record<string, string[]>,
  rowsBySid: Record<string, Instance[]>
): string[] {
  return Object.keys(groupsByAddress).sort((a, b) => {
    const aSids = groupsByAddress[a] || [];
    const bSids = groupsByAddress[b] || [];
    const aStarts = aSids.flatMap((sid) =>
      (rowsBySid[sid] || []).map((i) => i.start)
    );
    const bStarts = bSids.flatMap((sid) =>
      (rowsBySid[sid] || []).map((i) => i.start)
    );
    const aMin = aStarts.length ? Math.min(...aStarts) : Infinity;
    const bMin = bStarts.length ? Math.min(...bStarts) : Infinity;
    return aMin - bMin;
  });
}
