#!/bin/bash

# Build script for production deployment

echo "Building WellDiary application..."

# Install dependencies
npm ci

# Build the frontend
echo "Building frontend..."
npm run build

# The API will be handled by serverless functions
echo "Build complete!"

echo "For Vercel deployment:"
echo "1. Connect your Git repository to Vercel"
echo "2. Set environment variables in Vercel dashboard:"
echo "   - DATABASE_URL"
echo "   - HUGGINGFACE_API_KEY (optional)"
echo "   - ANTHROPIC_API_KEY (optional)"
echo "3. Deploy!"