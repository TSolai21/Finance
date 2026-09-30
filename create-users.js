import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mowrrjfoyqacfffgmedb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vd3JyamZveXFhY2ZmZmdtZWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTgyMzUsImV4cCI6MjEwNTgzNDIzNX0.8QbhU0V-I-MmP4JTjdDfX2mHVRTMqFMlh6zW7mZOB4A'
const supabase = createClient(supabaseUrl, supabaseKey)

async function createAccounts() {
  console.log('Fetching existing branches and centers...')
  const { data: branches } = await supabase.from('branches').select('id').limit(1)
  const { data: centers } = await supabase.from('centers').select('id').limit(1)
  
  const branchId = branches?.[0]?.id
  const centerId = centers?.[0]?.id

  const usersToCreate = [
    { email: 'admin@ramfinance.com', password: 'password123', full_name: 'Admin User', role: 'Admin' },
    { email: 'manager@ramfinance.com', password: 'password123', full_name: 'Branch Manager', role: 'Manager', branch_id: branchId },
    { email: 'staff@ramfinance.com', password: 'password123', full_name: 'Field Staff', role: 'Staff', branch_id: branchId, center_id: centerId },
    { email: 'staff2@ramfinance.com', password: 'password123', full_name: 'Junior Staff', role: 'Staff', branch_id: branchId, center_id: centerId }
  ]

  for (const u of usersToCreate) {
    console.log(`Signing up ${u.email}...`)
    const { data, error } = await supabase.auth.signUp({
      email: u.email,
      password: u.password,
    })
    
    // Auth might return error if user already exists, let's try to upsert profile anyway if we can get user by email, 
    // but signUp returns error for existing users.
    if (error && !error.message.includes('already registered')) {
      console.error(`Failed to create ${u.email}:`, error.message)
    } else {
      console.log(`Successfully created or found ${u.email}!`)
      
      const userId = data?.user?.id
      if (userId) {
          const payload = {
              id: userId,
              full_name: u.full_name,
              role: u.role
          }
          if (u.branch_id) payload.branch_id = u.branch_id
          // if (u.center_id) payload.center_id = u.center_id // Schema lacks center_id
          
          const { error: profileErr } = await supabase.from('profiles').upsert(payload)
          if (profileErr) console.log("Profile creation notice:", profileErr.message)
          else console.log(`Profile updated for ${u.email}`)
      } else {
          console.log(`User already exists for ${u.email}, skipping profile upsert (auth.signUp didn't return user id).`)
      }
    }
  }
}

createAccounts()
