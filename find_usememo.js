const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        const isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            callback(path.join(dir, f));
        }
    });
}

const targetDir = 'c:/dgre/src';
walkDir(targetDir, (filePath) => {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Check if useMemo is used
        if (content.match(/\buseMemo\b/) || content.match(/\buseMemoFirebase\b/)) {
            // Check if useMemo is imported
            // For useMemo, it should be from 'react'
            // For useMemoFirebase, it should be from '@/firebase' or something
            if (content.match(/\buseMemo\b/)) {
                if (!content.match(/import\s+{.*useMemo.*}\s+from\s+['"]react['"]/)) {
                    // Check if it's imported as React.useMemo
                    if (!content.match(/React\.useMemo/) && !content.match(/import\s+\*\s+as\s+React\s+from\s+['"]react['"]/)) {
                        console.log(`Missing useMemo import in: ${filePath}`);
                    }
                }
            }
        }
    }
});
