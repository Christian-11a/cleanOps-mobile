export type UserRole = 'customer' | 'employee' | 'admin';
export type JobStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'COMPLETED' | 'CANCELLED';
export type JobUrgency = 'LOW' | 'NORMAL' | 'HIGH';

export type PaymentBrand = 'Visa' | 'Mastercard' | 'Maya' | 'GCash';
export type PaymentType = 'card' | 'e-wallet';

export interface PaymentMethod {
  id: string;
  user_id: string;
  type: PaymentType;
  brand: PaymentBrand;
  last4?: string;
  expiry?: string;
  cardholderName?: string;
  phoneNumber?: string;
  isDefault: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  money_balance: number;
  onboarding_completed?: boolean;
  rating?: number;
  total_jobs?: number;
  settings: {
    pushNotifications: boolean;
    emailUpdates: boolean;
    smsAlerts: boolean;
    promos: boolean;
    biometrics: boolean;
  };
  service_radius: number;
  location_address?: string;
  created_at: string;
}

export interface EmployeeAvailability {
  employee_id: string;
  schedule: Record<string, boolean>;
  shift_start: string;
  shift_end: string;
  updated_at: string;
}

export interface Job {
  id: string;
  customer_id: string;
  employee_id?: string;
  status: JobStatus;
  urgency: JobUrgency;
  size?: string;
  tasks: string[];
  location_address: string;
  distance?: number;
  price_amount: number;
  proof_urls?: string[];
  proof_description?: string;
  customer_name?: string;
  customer_phone?: string;
  employee_name?: string;
  employee_phone?: string;
  custom_instructions?: string;
  created_at: string;
  updated_at?: string;
}

export interface WithdrawalTransaction {
  id: string;
  amount: number;
  method_brand: PaymentBrand;
  method_last4: string;
  method_name?: string;
  created_at: string;
}

export interface Message {
  id: string;
  job_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profiles?: {
    full_name: string;
  };
}
