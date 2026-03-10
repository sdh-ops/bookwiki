"use strict";

const { createClient } = require('@supabase/supabase-js');

// Load environment variables if available (e.g., from .env or GitHub Secrets)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://oryxiptdxmuubszuhvvf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_XY6W-bFCgz6bamD0Hp8PKg_dBbV6iUV';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = { supabase };
