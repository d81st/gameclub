export type StationType = 'ps' | 'billiard';
export type PaymentMethod = 'cash' | 'card' | 'transfer';

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: 'admin' | 'operator';
}

export interface ActiveSession {
  id: number;
  startedAt: string;
  hourlyRate: number;
}

export interface Station {
  id: number;
  name: string;
  type: StationType;
  hourlyRate: number;
  isActive: boolean;
  sortOrder: number;
  activeSession: ActiveSession | null;
}

export interface SessionRow {
  id: number;
  stationId: number;
  stationName: string;
  stationType: StationType;
  status: 'closed' | 'cancelled';
  startedAt: string;
  endedAt: string | null;
  hourlyRate: number;
  minutes: number | null;
  amount: number | null;
  amountFinal: number | null;
  paymentMethod: PaymentMethod | null;
  note: string;
  closedBy: string | null;
}

export interface RangeReport {
  from: string;
  to: string;
  days: Array<{
    day: string;
    sessionsCount: number;
    totalMinutes: number;
    revenue: number;
  }>;
  sessionsCount: number;
  totalMinutes: number;
  revenue: number;
  byStation: Array<{
    stationId: number;
    name: string;
    type: StationType;
    sessionsCount: number;
    totalMinutes: number;
    revenue: number;
  }>;
}

export interface DailyReport {
  date: string;
  sessionsCount: number;
  totalMinutes: number;
  revenue: number;
  byStation: Array<{
    stationId: number;
    name: string;
    type: StationType;
    sessionsCount: number;
    totalMinutes: number;
    revenue: number;
  }>;
  byPayment: Array<{
    method: PaymentMethod;
    sessionsCount: number;
    revenue: number;
  }>;
}
