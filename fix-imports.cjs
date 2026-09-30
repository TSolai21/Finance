const fs = require('fs')
const path = require('path')

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f)
    let isDirectory = fs.statSync(dirPath).isDirectory()
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f))
  })
}

walkDir(path.join(__dirname, 'src'), (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8')
    
    // Replace all relative imports pointing up to components, lib, store, pages with @/
    // Example: ../../lib/supabase -> @/lib/supabase
    // Example: ../components/layout/Layout -> @/components/layout/Layout
    const newContent = content.replace(/from\s+['"](\.\.\/)+(components|lib|store|pages)(.*?)['"]/g, "from '@/$2$3'")
    
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent)
      console.log('Fixed imports in', filePath)
    }
  }
})
