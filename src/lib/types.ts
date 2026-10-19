export type Role = 'admin' | 'hr_manager' | 'dept_manager' | 'employee';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export type Department = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type Employee = {
  id: string;
  profile_id: string;
  employee_code: string;
  department_id: string | null;
  job_title: string | null;
  employment_status: 'active' | 'inactive' | 'terminated' | 'on_leave';
  is_manager: boolean;
  hire_date: string;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
  // joined fields (optional)
  department?: Department | null;
  profile?: Pick<Profile, 'full_name' | 'email' | 'avatar_url' | 'phone'> | null;
};

export type Attendance = {
  id: string;
  employee_id: string;
  check_in: string;
  check_out: string | null;
  status: 'present' | 'late' | 'absent' | 'half_day' | 'leave';
  notes: string | null;
  created_at: string;
  employee?: Pick<Employee, 'employee_code' | 'job_title'> & {
    profile?: Pick<Profile, 'full_name'> | null;
  } | null;
};

export type LeaveType = {
  id: string;
  name: string;
  description: string | null;
  default_balance: number;
  is_paid: boolean;
  created_at: string;
};

export type LeaveRequest = {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approver_id: string | null;
  approved_at: string | null;
  approver_note: string | null;
  created_at: string;
  updated_at: string;
  leave_type?: LeaveType | null;
  employee?: Pick<Employee, 'employee_code'> & {
    profile?: Pick<Profile, 'full_name'> | null;
  } | null;
};

export type LeaveBalance = {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  balance: number;
  used: number;
  leave_type?: LeaveType | null;
};

export type PayrollRecord = {
  id: string;
  employee_id: string;
  pay_period_month: number;
  pay_period_year: number;
  base_salary: number;
  earnings: number;
  deductions: number;
  tax: number;
  net_pay: number;
  status: 'draft' | 'approved' | 'paid';
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  employee?: Pick<Employee, 'employee_code' | 'job_title'> & {
    profile?: Pick<Profile, 'full_name'> | null;
  } | null;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string;
  read: boolean;
  link: string | null;
  created_at: string;
};

export type HrDocument = {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};
