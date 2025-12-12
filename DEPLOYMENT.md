# Deployment Checklist for Netlify

## Pre-Deployment Checklist

✅ **Build Verification**
- [x] `npm run build` completes successfully
- [x] No TypeScript compilation errors
- [x] No ESLint errors or warnings

✅ **Configuration Files**
- [x] `netlify.toml` configured with correct build settings
- [x] `.gitignore` includes `node_modules` and `dist`
- [x] Firebase configuration is correct

✅ **Dependencies**
- [x] All dependencies are listed in `package.json`
- [x] No missing or outdated dependencies
- [x] Node version specified (18)

## Netlify Deployment Steps

1. **Push to Git Repository**
   ```bash
   git add .
   git commit -m "Prepare for Netlify deployment"
   git push origin main
   ```

2. **Connect to Netlify**
   - Go to [Netlify Dashboard](https://app.netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect your Git repository
   - Netlify will auto-detect settings from `netlify.toml`

3. **Build Settings** (Auto-detected from netlify.toml)
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: 18

4. **Environment Variables**
   - None required - Firebase config is hardcoded

5. **Deploy**
   - Click "Deploy site"
   - Wait for build to complete
   - Your site will be live!

## Post-Deployment Verification

- [ ] Site loads correctly
- [ ] Login page displays
- [ ] Firebase connection works (check browser console)
- [ ] Device list loads
- [ ] Dashboard displays correctly
- [ ] Charts render properly
- [ ] Export functionality works

## Firebase Database Rules

Ensure Firebase Realtime Database rules allow read access:

```json
{
  "rules": {
    ".read": true,
    ".write": false
  }
}
```

## Troubleshooting

**Build fails:**
- Check Node version is 18+
- Verify all dependencies are installed
- Check for TypeScript errors: `npm run build`

**Firebase connection issues:**
- Verify database URL is correct: `https://knose-e1959-default-rtdb.firebaseio.com/`
- Check Firebase database rules allow read access
- Check browser console for CORS or permission errors

**Routing issues:**
- Verify `netlify.toml` has redirect rule: `/* -> /index.html`
- This ensures React Router works correctly

## Support

For issues, check:
- Browser console for errors
- Netlify build logs
- Firebase console for database access

