import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mowrrjfoyqacfffgmedb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vd3JyamZveXFhY2ZmZmdtZWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTgyMzUsImV4cCI6MjEwNTgzNDIzNX0.8QbhU0V-I-MmP4JTjdDfX2mHVRTMqFMlh6zW7mZOB4A'
const supabase = createClient(supabaseUrl, supabaseKey)

async function seed() {
  console.log('Seeding branches...')
  let { data: branch, error: bErr } = await supabase.from('branches').insert({ name: 'North District', code: 'BR01' }).select().single()
  
  if (bErr && bErr.code !== '23505') {
    console.error('Branch Error', bErr)
  }
  if (!branch) {
      const { data } = await supabase.from('branches').select('*').limit(1)
      branch = data[0]
  }

  console.log('Seeding centers...')
  let { data: center, error: cErr } = await supabase.from('centers').insert({ branch_id: branch.id, name: 'Market Center', meeting_day: 'Monday' }).select().single()
  
  if (!center) {
      const { data } = await supabase.from('centers').select('*').limit(1)
      center = data[0]
  }

  console.log('Seeding customers...')
  let { data: cust1 } = await supabase.from('customers').insert({ client_id: 'RF0001', full_name: 'Anita Sharma', mobile_number: '+919876543210', gender: 'Female', address: '123 Market Rd', center_id: center.id }).select().single()
  let { data: cust2 } = await supabase.from('customers').insert({ client_id: 'RF0002', full_name: 'Vikram Singh', mobile_number: '+919876543211', gender: 'Male', address: '456 Hill St', center_id: center.id }).select().single()

  const customers = [cust1, cust2].filter(Boolean)
  if(customers.length === 0) {
      const { data } = await supabase.from('customers').select('*').limit(2)
      customers.push(...data)
  }

  console.log('Seeding loan products...')
  let { data: prod } = await supabase.from('loan_products').insert({ name: 'Standard Micro', type: 'Micro Finance', interest_rate: 12.0 }).select().single()
  if (!prod) {
      const { data } = await supabase.from('loan_products').select('*').limit(1)
      prod = data[0]
  }

  console.log('Seeding loans...')
  let { data: loan1 } = await supabase.from('loans').insert({ customer_id: customers[0].id, product_id: prod.id, loan_id: 'PPRA0001', principal_amount: 15000, tenure_weeks: 25, status: 'Active' }).select().single()
  let { data: loan2 } = await supabase.from('loans').insert({ customer_id: customers[1]?.id || customers[0].id, product_id: prod.id, loan_id: 'PPRA0002', principal_amount: 25000, tenure_weeks: 30, status: 'Pending Approval' }).select().single()

  const loans = [loan1, loan2].filter(Boolean)

  console.log('Seeding collections...')
  if (loans.length > 0) {
      await supabase.from('collections').insert({ loan_id: loans[0].id, customer_id: customers[0].id, amount: 750, payment_mode: 'Cash', status: 'Pending Approval' })
  }

  console.log('Database successfully seeded!')
}

seed().catch(console.error)
