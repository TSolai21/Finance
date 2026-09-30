const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const srcDir = path.join(__dirname, 'src')
const pagesDir = path.join(srcDir, 'pages')
const appDir = path.join(srcDir, 'app')

// Create app directory
if (!fs.existsSync(appDir)) {
  fs.mkdirSync(appDir, { recursive: true })
}

// Map old routes to new app router paths
const routes = {
  'Dashboard.tsx': 'page.tsx',
  'Customers.tsx': 'customers/page.tsx',
  'CustomerForm.tsx': 'customers/new/page.tsx',
  'CustomerDetails.tsx': 'customers/[id]/page.tsx',
  'Loans.tsx': 'loans/page.tsx',
  'LoanForm.tsx': 'loans/new/page.tsx',
  'LoanDetails.tsx': 'loans/[id]/page.tsx',
  'Collections.tsx': 'collections/page.tsx',
  'CollectionForm.tsx': 'collections/new/page.tsx',
  'CollectionVoucher.tsx': 'collections/[id]/page.tsx',
  'Approvals.tsx': 'approvals/page.tsx',
  'Reports.tsx': 'reports/page.tsx',
  'Settings.tsx': 'settings/page.tsx',
  'Login.tsx': 'login/page.tsx'
}

// Function to process file content
function processContent(content) {
  let newContent = '"use client";\n\n' + content

  // Replace react-router-dom imports
  newContent = newContent.replace(/import\s+{([^}]*)}\s+from\s+['"]react-router-dom['"]/g, (match, imports) => {
    const importList = imports.split(',').map(s => s.trim())
    let nextNavigation = []
    let nextLink = false

    if (importList.includes('useNavigate')) nextNavigation.push('useRouter')
    if (importList.includes('useParams')) nextNavigation.push('useParams')
    if (importList.includes('useLocation')) nextNavigation.push('usePathname')
    if (importList.includes('Link')) nextLink = true

    let newImports = ''
    if (nextNavigation.length > 0) {
      newImports += `import { ${nextNavigation.join(', ')} } from 'next/navigation';\n`
    }
    if (nextLink) {
      newImports += `import Link from 'next/link';\n`
    }
    return newImports.trim()
  })

  // Replace useNavigate with useRouter
  newContent = newContent.replace(/const navigate = useNavigate\(\)/g, 'const router = useRouter()')
  newContent = newContent.replace(/navigate\(/g, 'router.push(')
  // special case for navigate(-1) -> router.back()
  newContent = newContent.replace(/router\.push\(-1\)/g, 'router.back()')

  // Replace Link `to` with `href`
  newContent = newContent.replace(/<Link\s+to=/g, '<Link href=')

  return newContent
}

// Move and process pages
for (const [oldFile, newPath] of Object.entries(routes)) {
  const oldPathFull = path.join(pagesDir, oldFile)
  if (fs.existsSync(oldPathFull)) {
    const newPathFull = path.join(appDir, newPath)
    fs.mkdirSync(path.dirname(newPathFull), { recursive: true })
    
    const content = fs.readFileSync(oldPathFull, 'utf8')
    const processed = processContent(content)
    
    fs.writeFileSync(newPathFull, processed)
    console.log(`Migrated ${oldFile} to ${newPath}`)
  }
}

// Process Layout.tsx
const layoutPath = path.join(srcDir, 'components', 'layout', 'Layout.tsx')
if (fs.existsSync(layoutPath)) {
  let content = fs.readFileSync(layoutPath, 'utf8')
  content = processContent(content)
  // Remove Outlet
  content = content.replace(/<Outlet \/>/g, '{children}')
  // Add children prop
  content = content.replace(/export function Layout\(\) {/, 'export function Layout({ children }: { children: React.ReactNode }) {')
  fs.writeFileSync(layoutPath, content)
  console.log('Migrated Layout.tsx')
}

// Create Root Layout
const rootLayout = `import '../index.css'
import { AppQueryProvider } from '../lib/react-query'
import { ClientLayout } from './ClientLayout'

export const metadata = {
  title: 'RAM Finance',
  description: 'Finance Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppQueryProvider>
          <ClientLayout>{children}</ClientLayout>
        </AppQueryProvider>
      </body>
    </html>
  )
}`
fs.writeFileSync(path.join(appDir, 'layout.tsx'), rootLayout)

// Create ClientLayout wrapper to handle auth and layout UI
const clientLayout = `"use client";
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/appStore'
import { Layout } from '../components/layout/Layout'
import { Login } from './login/page'
import { useRouter, usePathname } from 'next/navigation'

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = useAppStore(state => state.user)
  const setUser = useAppStore(state => state.setUser)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [setUser])

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>
  }

  if (!user) {
    return <Login />
  }

  return <Layout>{children}</Layout>
}`
fs.writeFileSync(path.join(appDir, 'ClientLayout.tsx'), clientLayout)

// Update package.json
const pkgPath = path.join(__dirname, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
delete pkg.dependencies['react-router-dom']
delete pkg.devDependencies['vite']
delete pkg.devDependencies['@vitejs/plugin-react']
pkg.dependencies['next'] = '15.0.0'
pkg.scripts = {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint"
}
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))

// Clean up Vite specific files
const filesToRemove = ['vite.config.ts', 'index.html', 'src/App.tsx', 'src/main.tsx', 'src/pages']
for (const f of filesToRemove) {
  const fp = path.join(__dirname, f)
  if (fs.existsSync(fp)) {
    fs.rmSync(fp, { recursive: true, force: true })
  }
}

console.log('Migration complete!')
