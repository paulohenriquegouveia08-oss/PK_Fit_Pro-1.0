import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://fuovtooenanzcrsgpsxq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1b3Z0b29lbmFuemNyc2dwc3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NDE4NzMsImV4cCI6MjA4MTMxNzg3M30._rf15v-_Qw__kmX2bqV_JC2xQPVrFYOfdfisYmyAses');
supabase.from('academy_users').select('academy_id, user_id, users!inner(role, photo_url)').then(r => console.log(JSON.stringify(r.data, null, 2)));
