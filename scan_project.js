/**
 * File: scan_project.js
 * Description: Script to scan all project files and output their contents for review
 * 
 * Version History:
 * v1.0.0 (2025-05-18) - Initial implementation
 */

const fs = require('fs');
const path = require('path');

// Directories to exclude
const excludeDirs = ['node_modules', '.git', 'build', 'dist'];

// Files to exclude
const excludeFiles = ['.DS_Store', '.gitignore', 'package-lock.json'];

// File extensions to include
const includeExtensions = ['.js', '.jsx', '.html', '.css', '.json', '.md'];

// Configuration
const outputFile = 'project_files_review.txt';
const startDir = '.'; // Current directory

// Helper function to check if a file should be included
function shouldIncludeFile(filePath) {
  const fileName = path.basename(filePath);
  
  // Skip excluded files
  if (excludeFiles.includes(fileName)) {
    return false;
  }
  
  // Check file extension
  const ext = path.extname(filePath).toLowerCase();
  if (!includeExtensions.includes(ext)) {
    return false;
  }
  
  return true;
}

// Helper function to scan a directory recursively
function scanDirectory(dir, output) {
  try {
    // Read directory contents
    const items = fs.readdirSync(dir);
    
    // Process each item
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      // Process directories
      if (stat.isDirectory()) {
        // Skip excluded directories
        if (excludeDirs.includes(item)) {
          continue;
        }
        
        // Recursively scan subdirectories
        scanDirectory(itemPath, output);
      } 
      // Process files
      else if (stat.isFile() && shouldIncludeFile(itemPath)) {
        // Read file content
        const content = fs.readFileSync(itemPath, 'utf8');
        
        // Add to output
        output.push({
          path: itemPath,
          content: content
        });
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error);
  }
}

// Main function
function main() {
  // Get current date and time
  const now = new Date().toISOString().replace(/:/g, '-');
  
  console.log(`Starting project scan at: ${now}`);
  console.log(`Output will be saved to: ${outputFile}`);
  
  // Collect all files
  const files = [];
  scanDirectory(startDir, files);
  
  // Sort files by path
  files.sort((a, b) => a.path.localeCompare(b.path));
  
  // Create output
  let output = `# Project Files Review\n`;
  output += `# Generated: ${now}\n`;
  output += `# Total files: ${files.length}\n\n`;
  
  // Add each file
  files.forEach((file, index) => {
    output += `\n${'='.repeat(80)}\n`;
    output += `File: ${file.path}\n`;
    output += `${'='.repeat(80)}\n\n`;
    output += file.content;
    output += '\n';
  });
  
  // Write output to file
  fs.writeFileSync(outputFile, output);
  
  console.log(`Scan complete. Found ${files.length} files.`);
  console.log(`Output saved to: ${outputFile}`);
}

// Run the script
main();