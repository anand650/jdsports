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