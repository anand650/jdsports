export interface Agent {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface Call {
  id: string;
  customer_number: string;
  agent_id: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  twilio_call_sid?: string;
  twilio_conference_sid?: string;
  call_status?: string;
  call_direction?: string;
  caller_country?: string;
  caller_state?: string;
  caller_city?: string;
  call_duration?: number;
  recording_url?: string;
  recording_duration?: number;
  satisfaction_score?: number;
  resolution_status?: 'resolved' | 'unresolved' | 'escalated' | 'pending';
  first_response_time?: number;
  resolution_time?: number;
}

export interface CustomerProfile {
  id: string;
  phone_number: string;
  name?: string;
  email?: string;
  preferred_language?: string;
  timezone?: string;
  call_history_count: number;
  last_interaction_at?: string;
  customer_notes?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface CallAnalytics {
  totalCalls: number;
  avgCallDuration: number;
  resolutionRate: number;
  avgSatisfactionScore: number;
  activeAgents: number;
  callVolumeByHour: Array<{ hour: string; count: number }>;
  resolutionBreakdown: Array<{ status: string; count: number }>;
  satisfactionDistribution: Array<{ score: number; count: number }>;
}

export interface Transcript {
  id: string;
  call_id: string;
  role: 'customer' | 'agent';
  text: string;
  created_at: string;
}

export interface Suggestion {
  id: string;
  call_id: string;
  text: string;
  created_at: string;
}