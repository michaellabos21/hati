// Verifies the Supabase project in .env is reachable with the anon key.
// Run with: npm run check:supabase
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!url || !anonKey) {
  fail('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set in .env.');
}

let health;
try {
  health = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anonKey } });
} catch (error) {
  fail(`Could not reach ${url}: ${error.message}`);
}
if (!health.ok) {
  fail(`Auth health check returned HTTP ${health.status}. Check the URL and anon key.`);
}
console.log(`✓ Reached ${url} (auth health OK)`);

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
const { error } = await supabase.auth.getSession();
if (error) {
  fail(`Supabase client failed to initialise: ${error.message}`);
}
console.log('✓ Supabase client initialised with the anon key');
