import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database schema helper - creates the logs table if it doesn't exist
export const initializeDatabase = async () => {
  try {
    // Check if table exists by trying to select from it
    const { data, error } = await supabase
      .from('logs')
      .select('id')
      .limit(1)
    
    if (error && error.code === '42P01') {
      // Table doesn't exist, but we can't create it from client
      console.warn('Logs table does not exist. Please create it in Supabase dashboard.')
      return false
    }
    
    return true
  } catch (error) {
    console.error('Database initialization error:', error)
    return false
  }
}
