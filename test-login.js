import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mowrrjfoyqacfffgmedb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vd3JyamZveXFhY2ZmZmdtZWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTgyMzUsImV4cCI6MjEwNTgzNDIzNX0.8QbhU0V-I-MmP4JTjdDfX2mHVRTMqFMlh6zW7mZOB4A'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkLogin() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@ramfinance.com',
    password: 'password123',
  })
  
  if (error) {
    console.error('Login Error:', error.message)
  } else {
    console.log('Login Success!', data.user.id)
  }
}

checkLogin()
