// Mobile equivalent of actions/jobs.ts
import { supabase } from '@/lib/supabase';
import type { Job, JobStatus, JobUrgency } from '@/types';

// Helper to parse tasks from JSONB (can be string[] or {name:string}[])
function parseTasks(tasks: any[]): string[] {
  if (!tasks || !Array.isArray(tasks)) return [];
  // Filter out meta-objects like 'size' and 'instruction' when displaying tasks
  return tasks
    .filter((t) => typeof t === 'string' || (typeof t === 'object' && t.type !== 'size' && t.type !== 'instruction'))
    .map((t) => (typeof t === 'string' ? t : t.name ?? t.task ?? String(t)));
}

export async function createJob(jobData: {
  tasks: string[];
  urgency: JobUrgency;
  address: string;
  distance: number;
  price: number;
  size: string;
  customInstructions?: string;
}): Promise<Job> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Fetch customer name and phone for persistence
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('full_name, phone')
    .eq('id', user.id)
    .single();

  // Inject meta into tasks JSONB
  const tasksWithMeta: any[] = [...jobData.tasks];
  if (jobData.size) {
    tasksWithMeta.push({ type: 'size', value: jobData.size });
  }
  if (jobData.customInstructions) {
    tasksWithMeta.push({ type: 'instruction', value: jobData.customInstructions });
  }

  const { data, error } = await (supabase as any)
    .from('jobs')
    .insert([{
      customer_id: user.id,
      customer_name: profile?.full_name,
      customer_phone: profile?.phone,
      urgency: jobData.urgency,
      location_address: jobData.address,
      distance: jobData.distance,
      price_amount: jobData.price,
      status: 'OPEN',
      tasks: tasksWithMeta,
    }])
    .select()
    .single();

  if (error) throw error;

  // Deduct balance and hold in escrow
  const { error: escrowErr } = await (supabase as any).rpc('hold_escrow', {
    p_job_id: data.id,
    p_customer_id: user.id,
    p_amount: jobData.price,
  });
  if (escrowErr) {
    await (supabase as any).from('jobs').delete().eq('id', data.id);
    throw escrowErr;
  }

  return normalizeJob(data);
}

// Upload proof image to Supabase Storage bucket 'proof-images'
// Make sure the bucket exists and is public in your Supabase dashboard
export async function uploadProofImage(uri: string, userId: string): Promise<string> {
  const fileName = `proof_${userId}_${Date.now()}.jpg`;
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const { data, error } = await (supabase as any).storage
    .from('proof-images')
    .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

  if (error) throw error;

  const { data: { publicUrl } } = (supabase as any).storage
    .from('proof-images')
    .getPublicUrl(data.path);

  return publicUrl;
}

export async function getCustomerJobs(status?: JobStatus): Promise<Job[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

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
    .is('worker_id', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizeJob);
}

export async function getAllOpenJobs(): Promise<Job[]> {
  return getOpenJobs();
}

export async function getEmployeeJobs(status?: JobStatus): Promise<Job[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

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

  // Validation: Check if job is still OPEN
  const { data: job } = await (supabase as any)
    .from('jobs')
    .select('status')
    .eq('id', jobId)
    .single();

  if (!job || job.status !== 'OPEN') {
    throw new Error('This job is no longer available to be claimed.');
  }

  // Fetch employee name and phone
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('full_name, phone')
    .eq('id', user.id)
    .single();

  const { error } = await (supabase as any).rpc('claim_job', {
    p_job_id: jobId,
    p_employee_id: user.id,
  });

  if (error) throw error;

  // Persist the worker name and phone for history
  await (supabase as any)
    .from('jobs')
    .update({ 
      worker_name: profile?.full_name,
      worker_phone: profile?.phone 
    })
    .eq('id', jobId);
}

export async function applyForJob(jobId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: job, error: jobErr } = await (supabase as any)
    .from('jobs')
    .select('status, worker_id, worker_name')
    .eq('id', jobId)
    .single();

  if (jobErr) throw new Error(`Could not verify job status: ${jobErr.message}`);

  if (!job || job.status !== 'OPEN') {
    throw new Error('This job is no longer open for applications.');
  }

  if (job.worker_id) {
    throw new Error('This job already has an assigned cleaner.');
  }

  // Prevent overwriting another applicant's pending application
  if (job.worker_name) {
    throw new Error('Another cleaner has already applied. Please try a different job.');
  }

  const { data: profile, error: profErr } = await (supabase as any)
    .from('profiles')
    .select('full_name, phone')
    .eq('id', user.id)
    .single();

  if (profErr) throw new Error('Could not fetch your profile. Please check your settings.');

  const { error: updateErr } = await (supabase as any)
    .from('jobs')
    .update({
      worker_id:    user.id,
      worker_name:  profile?.full_name || 'Cleaner',
      worker_phone: profile?.phone     || 'N/A',
    })
    .eq('id', jobId);

  if (updateErr) throw new Error(`Application failed: ${updateErr.message}`);
}

export async function approveApplication(jobId: string, employeeId: string): Promise<void> {
  if (!employeeId) throw new Error('No employee selected to approve.');

  // Uses approve_job_application RPC (migration 024) — customer-callable, sets worker_id + IN_PROGRESS
  const { error } = await (supabase as any).rpc('approve_job_application', {
    p_job_id:      jobId,
    p_employee_id: employeeId,
  });

  if (error) throw error;
}

export async function rejectApplication(jobId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await (supabase as any)
    .from('jobs')
    .update({ worker_id: null, worker_name: null, worker_phone: null })
    .eq('id', jobId)
    .eq('customer_id', user.id)
    .eq('status', 'OPEN');

  if (error) throw error;
}

export async function cancelJob(jobId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: job, error: jobErr } = await (supabase as any)
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobErr || !job) throw new Error('Job not found');
  if (job.customer_id !== user.id) throw new Error('Forbidden');
  if (job.status !== 'OPEN') {
    throw new Error('Can only cancel jobs that haven\'t been claimed yet.');
  }

  // Refund logic: Return price_amount to user balance
  const refundAmount = job.price_amount;
  const { error: refundErr } = await (supabase as any).rpc('add_money', {
    user_id: user.id,
    amount: refundAmount,
  });

  if (refundErr) throw new Error('Failed to process refund. Please contact support.');

  // Update status
  await updateJobStatus(jobId, 'CANCELLED');
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  proofOfWork?: string[],
  proofDescription?: string,
): Promise<void> {
  const updateData: Record<string, any> = { status };

  // Database column is proof_of_work (JSONB).
  // If we have a description but no separate column, we store it as an object entry in the array.
  if (proofOfWork) {
    const proofData: any[] = [...proofOfWork];
    if (proofDescription) {
      proofData.push({ type: 'comment', content: proofDescription });
    }
    updateData.proof_of_work = proofData;
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

  // 10% platform fee — consistent with what's shown throughout the UI
  const platformFee = Math.round((job as any).price_amount * 0.10);
  const { error: escrowError } = await (supabase as any).rpc('release_escrow', {
    p_job_id: jobId,
    p_employee_id: (job as any).worker_id,
    p_amount: (job as any).price_amount,
    p_platform_fee: platformFee,
  });

  if (escrowError) throw escrowError;

  await updateJobStatus(jobId, 'COMPLETED');
}

// Uses the updated get_nearby_jobs RPC (migration 023) which queries by distance column, not PostGIS coords
export async function getNearbyJobs(radiusKm = 50): Promise<Job[]> {
  const { data, error } = await (supabase as any).rpc('get_nearby_jobs', {
    radius_km: radiusKm,
  });
  if (error) throw error;
  return (data ?? []).map(normalizeJob);
}

// Normalize job from DB to our Job type
// Handles JSONB tasks (can be string[] or object[]) and worker_id -> employee_id mapping
function normalizeJob(raw: any): Job {
  const rawTasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  const sizeObj = rawTasks.find((t: any) => t && typeof t === 'object' && t.type === 'size');
  const instrObj = rawTasks.find((t: any) => t && typeof t === 'object' && t.type === 'instruction');

  const proof_of_work = Array.isArray(raw.proof_of_work) ? raw.proof_of_work : [];
  const commentObj = proof_of_work.find((p: any) => p && typeof p === 'object' && p.type === 'comment');
  const proof_urls = proof_of_work
    .filter((p: any) => p && (typeof p === 'string' || (typeof p === 'object' && p.type !== 'comment')))
    .map((p: any) => (typeof p === 'string' ? p : p.url ?? String(p)));

  return {
    ...raw,
    tasks: parseTasks(rawTasks),
    size: sizeObj?.value || raw.size,
    custom_instructions: instrObj?.value || raw.custom_instructions,
    proof_urls,
    proof_description: commentObj?.content || raw.proof_description,
    employee_id: raw.worker_id, // map worker_id to employee_id for our type
    employee_name: raw.worker_name, // map worker_name to employee_name for our type
    employee_phone: raw.worker_phone, // map worker_phone to employee_phone for our type
    customer_phone: raw.customer_phone,
  } as Job;
}

