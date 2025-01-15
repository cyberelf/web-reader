#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get release version and notes from command line arguments
const releaseId = process.argv[2];
const releaseNotes = process.argv.slice(3).join(' ');

if (!releaseId) {
  console.error('Please provide a release version (e.g., 1.2.3)');
  process.exit(1);
}

if (!releaseNotes) {
  console.error('Please provide release notes');
  process.exit(1);
}

// Validate version format
if (!/^\d+\.\d+\.\d+$/.test(releaseId)) {
  console.error('Release version must be in format: x.y.z (e.g., 1.2.3)');
  process.exit(1);
}

try {
  // Update package.json version
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Skip if version is already set
  if (packageJson.version === releaseId) {
    console.log(`Version ${releaseId} is already set in package.json`);
  } else {
    packageJson.version = releaseId;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }

  // Update manifest.json version
  const manifestPath = path.join(__dirname, '..', 'src', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Skip if version is already set
  if (manifest.version === releaseId) {
    console.log(`Version ${releaseId} is already set in manifest.json`);
  } else {
    manifest.version = releaseId;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }

  // Check if there are any changes to commit
  const status = execSync('git status --porcelain').toString();
  if (!status) {
    console.log('No changes to commit');
  } else {
    // Git operations
    console.log('Committing version updates...');
    execSync('git add .');
    execSync(`git commit -m "chore: bump version to ${releaseId}"`);
  }

  // Check if tag exists
  const tagExists = execSync(`git tag -l v${releaseId}`).toString().trim() !== '';
  
  if (tagExists) {
    console.log(`Tag v${releaseId} exists, deleting it...`);
    execSync(`git tag -d v${releaseId}`);
    execSync(`git push origin :refs/tags/v${releaseId}`);
  }

  // Create and push new tag
  console.log('Creating new tag with release notes...');
  execSync(`git tag -a v${releaseId} -m "${releaseNotes}"`);
  execSync('git push');
  execSync(`git push origin v${releaseId}`);

  console.log(`\nSuccessfully created release v${releaseId}`);
  console.log('The GitHub Action will automatically create the release.');
} catch (error) {
  console.error('Error creating release:', error.message);
  process.exit(1);
} 