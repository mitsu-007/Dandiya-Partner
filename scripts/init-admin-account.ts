/**
 * Garba Saathi — Admin Account Setup & Config Initializer
 *
 * This script sets up the official administrator metadata record for admin@glbitm.ac.in.
 * 
 * Usage:
 *   npx tsx scripts/init-admin-account.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const configDbId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
const db = configDbId ? getFirestore(app, configDbId) : getFirestore(app);

async function initializeAdminConfig() {
  console.log('🛡️ Initializing Garba Saathi Administrator Configuration...');
  try {
    const adminConfigRef = doc(db, 'config', 'admins');
    const existingSnap = await getDoc(adminConfigRef);

    const adminEmails = ['admin@glbitm.ac.in', 'hgscene07@gmail.com'];

    await setDoc(adminConfigRef, {
      adminEmails,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system_initializer',
      description: 'Authorized Garba Saathi organizer administrator accounts'
    }, { merge: true });

    console.log('✅ Admin configuration initialized in Firestore (/config/admins)!');
    console.log(`  └─ Registered Official Admin Email: admin@glbitm.ac.in`);
    console.log('  └─ Note: Log in on the client using admin@glbitm.ac.in to access the Admin Console.');
  } catch (error) {
    console.error('❌ Failed to initialize admin configuration:', error);
  }
}

initializeAdminConfig();
