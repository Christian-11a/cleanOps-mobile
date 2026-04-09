// Mobile equivalent of app/actions/jobs.ts
import { supabase } from '@/lib/supabase';
import type { Job, JobStatus, JobUrgency } from '@/types';

// Helper to parse tasks from JSONB (can be string[] or {name:string}[])
function parseTasks(tasks: any[]): string[] {
  if (!tasks || !Array.isArray(tasks)) return [];
  return tasks.map((t) => (typeof t === 'string' ? t : t.name ?? t.task ?? String(t)));
}

export async function createJob(jobData: {
  tasks: string[];
  urgency: JobUrgency;
  address: string;
  distance: number;
  price: number;
}): Promise<Job> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Tasks stored as JSONB array of strings — no balance deduction (mock payment like web)
  const { data, error } = await (supabase as any)
    .from('jobs')
    .insert([{
      customer_id: user.id,
      urgency: jobData.urgency,
      location_address: jobData.address,
      distance: jobData.distance,
      price_amount: jobData.price,
      status: 'OPEN',
      tasks: jobData.tasks,       // plain string array — Supabase stores as JSONB
    }])
    .select()
    .single();

  if (error) throw error;
  return normalizeJob(data);
}

export async function getCustomerJobs(status?: JobStatus): Promise<Job[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  let query = (supabase as any)
    .from('jobs')
    .select('*')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(normalizeJob);
}

export async function getOpenJobs(): Promise<Job[]> {
  const { data, error } = await (supabase as any)
    .from('jobs')
    .select('*')
    .eq('status', 'OPEN')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizeJob);
}

export async function getAllOpenJobs(): Promise<Job[]> {
  return getOpenJobs();
}

export async function getEmployeeJobs(status?: JobStatus): Promise<Job[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Column is worker_id not employee_id
  let query = (supabase as any)
    .from('jobs')
    .select('*')
    .eq('worker_id', user.id)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(normalizeJob);
}

export async function getAllJobs(): Promise<Job[]> {
  const { data, error } = await (supabase as any)
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizeJob);
}

export async function getJob(id: string): Promise<Job> {
  const { data, error } = await (supabase as any)
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return normalizeJob(data);
}

export async function claimJob(jobId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await (supabase as any).rpc('claim_job', {
    p_job_id: jobId,
    p_employee_id: user.id,
  });

  if (error) throw error;
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  proofOfWork?: string[],
  proofDescription?: string,
): Promise<void> {
  const updateData: Record<string, any> = { status };

  // Database column is proof_of_work (JSONB), not proof_urls
  if (proofOfWork) {
    updateData.proof_of_work = proofOfWork;
  }

  const { error } = await (supabase as any)
    .from('jobs')
    .update(updateData)
    .eq('id', jobId);

  if (error) throw error;
}

export async function approveJobCompletion(jobId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: job } = await (supabase as any)
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (!job || (job as any).customer_id !== user.id) throw new Error('Forbidden');

  // Use release_escrow RPC — same as web
  const platformFee = Math.round((job as any).price_amount * 0.15);
  const { error: escrowError } = await (supabase as any).rpc('release_escrow', {
    p_job_id: jobId,
    p_employee_id: (job as any).worker_id,
    p_amount: (job as any).price_amount / 100,
    p_platform_fee: platformFee / 100,
  });

  if (escrowError) throw escrowError;

  await updateJobStatus(jobId, 'COMPLETED');
}

export async function getNearbyJobs(lat: number, lng: number, radiusMeters = 50000): Promise<Job[]> {
  const { data, error } = await (supabase as any).rpc('get_nearby_jobs', {
    lat,
    lng,
    radius_meters: radiusMeters,
  });
  if (error) throw error;
  return (data ?? []).map(normalizeJob);
}

// Normalize job from DB to our Job type
// Handles JSONB tasks (can be string[] or object[]) and worker_id -> employee_id mapping
function normalizeJob(raw: any): Job {
  return {
    ...raw,
    tasks: parseTasks(raw.tasks ?? []),
    proof_urls: Array.isArray(raw.proof_of_work)
      ? raw.proof_of_work.map((p: any) => (typeof p === 'string' ? p : p.url ?? String(p)))
      : [],
    employee_id: raw.worker_id, // map worker_id to employee_id for our type
  } as Job;
}