import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://mowrrjfoyqacfffgmedb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vd3JyamZveXFhY2ZmZmdtZWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTgyMzUsImV4cCI6MjEwNTgzNDIzNX0.8QbhU0V-I-MmP4JTjdDfX2mHVRTMqFMlh6zW7mZOB4A'
)

async function test() {
  const { data, error } = await supabase.from('customers').select('*').limit(1)
  if (error) {
    console.error('Supabase Error:', error.message, error.details, error.hint)
  } else {
    console.log('Success:', data)
  }
}

test()
