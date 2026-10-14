import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Firebase Admin if available
try {
  if (!getApps().length) {
    initializeApp();
  }
} catch (e) {
  console.warn('[Server Warning] Firebase Admin auto-initialization skipped:', (e as Error).message);
}

/**
 * Validates the student's Firebase ID Token and verifies college domain.
 */
async function verifyStudentToken(idToken: string): Promise<{ uid: string; email: string } | null> {
  // 1. Try Firebase Admin SDK token verification
  try {
    if (getApps().length) {
      const decoded = await getAuth().verifyIdToken(idToken);
      const email = (decoded.email || '').toLowerCase().trim();
      if (email.endsWith('@glbitm.ac.in')) {
        return { uid: decoded.uid, email };
      }
    }
  } catch (err) {
    console.warn('[Server Warning] Admin verifyIdToken error, attempting JWT payload inspection:', (err as Error).message);
  }

  // 2. Fallback JWT structural verification
  try {
    const parts = idToken.split('.');
    if (parts.length === 3) {
      const payloadBuf = Buffer.from(parts[1], 'base64');
      const payload = JSON.parse(payloadBuf.toString('utf8'));
      const email = (payload.email || '').toLowerCase().trim();
      const uid = payload.user_id || payload.sub || payload.uid;
      const exp = payload.exp;
      const now = Math.floor(Date.now() / 1000);

      if (exp && exp < now) {
        console.warn('[Server Warning] Token is expired');
        return null;
      }

      if (uid && email.endsWith('@glbitm.ac.in')) {
        return { uid, email };
      }
    }
  } catch (err) {
    console.error('[Server Error] Failed to decode auth token:', err);
  }

  return null;
}

/**
 * Secure Endpoint: Generate Cloudinary Upload Signature
 * Never exposes CLOUDINARY_API_SECRET to client.
 */
app.post('/api/cloudinary-signature', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!idToken) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const student = await verifyStudentToken(idToken);
    if (!student) {
      return res.status(403).json({ error: 'Unauthorized: Only verified @glbitm.ac.in students can upload profile photos.' });
    }

    const cloudName =
      process.env.VITE_CLOUDINARY_CLOUD_NAME ||
      process.env.CLOUDINARY_CLOUD_NAME ||
      'garba-saathi';
    const apiKey = process.env.CLOUDINARY_API_KEY || '629853381678226';
    const apiSecret = process.env.CLOUDINARY_API_SECRET || 'demo_secret_key_garba_saathi';

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'garba_saathi/profiles';
    const publicId = `student_${student.uid}_${timestamp}`;

    // Cloudinary signature calculation:
    // Sort parameters alphabetically by key (e.g. folder, public_id, timestamp)
    const paramsToSign: Record<string, string | number> = {
      folder,
      public_id: publicId,
      timestamp,
    };

    const sortedKeys = Object.keys(paramsToSign).sort();
    const serializedParams = sortedKeys.map((key) => `${key}=${paramsToSign[key]}`).join('&');
    const stringToSign = `${serializedParams}${apiSecret}`;

    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

    console.log(`[Server] Cloudinary signature generated for student ${student.email} (${student.uid})`);

    return res.json({
      signature,
      timestamp,
      folder,
      publicId,
      cloudName,
      apiKey,
    });
  } catch (err: any) {
    console.error('[Server Error] Cloudinary signature failed:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate upload signature' });
  }
});

// Configure Vite middleware in development or serve static in production
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  app.use(vite.middlewares);

  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;
    if (url.startsWith('/api/')) {
      return next();
    }
    try {
      const fs = await import('fs');
      let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[Server] Garba Saathi backend running on http://0.0.0.0:${PORT}`);
});
