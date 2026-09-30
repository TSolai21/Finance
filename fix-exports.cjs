const fs = require('fs')
const path = require('path')

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f)
    let isDirectory = fs.statSync(dirPath).isDirectory()
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f))
  })
}

walkDir(path.join(__dirname, 'src', 'app'), (filePath) => {
  if (filePath.endsWith('page.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8')
    
    // Replace "export function Something(" with "export default function Something("
    // making sure we don't duplicate default if it's already there
    content = content.replace(/export\s+function\s+([A-Za-z0-9_]+)\s*\(/g, "export default function $1(")
    
    fs.writeFileSync(filePath, content)
    console.log('Fixed export in', filePath)
  }
})
