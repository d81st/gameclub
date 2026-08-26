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
  playersCount: number | null;
  rateKind: 'standard' | 'group';
  openedBy: string | null;
}

export interface Station {
  id: number;
  name: string;
  type: StationType;
  hourlyRate: number;
  groupEnabled: boolean;
  groupRate: number | null;
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
  playersCount: number | null;
  rateKind: 'standard' | 'group';
  closedBy: string | null;
}

export type ProductCategory = 'drink' | 'snack' | 'other';

export interface Product {
  id: number;
  name: string;
  price: number;
  category: ProductCategory;
  isActive: boolean;
  sortOrder: number;
}

export interface SaleRow {
  id: number;
  createdAt: string;
  total: number;
  paymentMethod: PaymentMethod | null;
  sessionId: number | null;
  stationName: string | null;
  note: string;
  createdBy: string;
  items: Array<{ name: string; qty: number; amount: number }>;
}

export interface RangeReport {
  from: string;
  to: string;
  days: Array<{
    day: string;
    sessionsCount: number;
    totalMinutes: number;
    revenue: number;
    barRevenue: number;
    totalRevenue: number;
  }>;
  sessionsCount: number;
  totalMinutes: number;
  revenue: number;
  barRevenue: number;
  totalRevenue: number;
  topProducts: Array<{ name: string; qty: number; revenue: number }>;
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
  barSalesCount: number;
  barRevenue: number;
  totalRevenue: number;
  topProducts: Array<{ name: string; qty: number; revenue: number }>;
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
