import { initializeApp as initAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth, UserRecord } from 'firebase-admin/auth';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

/**
 * Garba Saathi — Admin Custom Claim & Configuration Setup
 * 
 * Usage:
 *   npx tsx scripts/setup-admin-claim.ts [email_or_uid]
 */

const targetEmail = process.argv[2] || 'admin@glbitm.ac.in';

async function setupAdminClaim() {
  console.log(`🛡️  Setting up Admin privileges for: ${targetEmail}...`);

  let targetUid = '';

  // 1. Attempt using Firebase Admin SDK
  try {
    if (!getAdminApps().length) {
      const projectId = (firebaseConfig as any).projectId;
      initAdminApp({
        projectId,
      });
    }

    const adminAuth = getAuth();

    try {
      let userRecord: UserRecord;
      if (targetEmail.includes('@')) {
        userRecord = await adminAuth.getUserByEmail(targetEmail);
      } else {
        userRecord = await adminAuth.getUser(targetEmail);
      }

      targetUid = userRecord.uid;
      console.log(`✅ Found Auth User (UID: ${targetUid})`);

      // Set custom user claim: admin: true
      await adminAuth.setCustomUserClaims(targetUid, { admin: true });
      console.log(`✅ Attached custom claim { admin: true } to UID ${targetUid}`);

      // Verify custom claim
      const updatedUserRecord = await adminAuth.getUser(targetUid);
      if (updatedUserRecord.customClaims?.admin === true) {
        console.log('🎉 Verification PASSED: customClaims.admin === true');
      } else {
        console.warn('⚠️  Warning: Custom claim verification returned unexpected value:', updatedUserRecord.customClaims);
      }
    } catch (adminSDKError: any) {
      console.warn('ℹ️  Firebase Admin SDK auth operation notice:', adminSDKError.message || adminSDKError);
      console.log('   Proceeding to Firestore admin registry seeding fallback...');
    }
  } catch (err: any) {
    console.warn('ℹ️  Firebase Admin SDK initialization notice:', err.message || err);
  }

  // 2. Seed /config/admins in Firestore via Client SDK to ensure rule fallback works
  try {
    const clientApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const dbId = (firebaseConfig as any).firestoreDatabaseId;
    const db = dbId ? getFirestore(clientApp, dbId) : getFirestore(clientApp);

    const adminConfigRef = doc(db, 'config', 'admins');
    const existingSnap = await getDoc(adminConfigRef);

    const currentUids: string[] = existingSnap.exists() ? (existingSnap.data().uids || []) : [];
    const currentEmails: string[] = existingSnap.exists() ? (existingSnap.data().adminEmails || []) : [];

    if (targetUid && !currentUids.includes(targetUid)) {
      currentUids.push(targetUid);
    }
    if (!currentEmails.includes('admin@glbitm.ac.in')) {
      currentEmails.push('admin@glbitm.ac.in');
    }
    if (targetEmail.includes('@') && !currentEmails.includes(targetEmail.toLowerCase())) {
      currentEmails.push(targetEmail.toLowerCase());
    }

    await setDoc(adminConfigRef, {
      uids: currentUids,
      adminEmails: currentEmails,
      updatedAt: new Date().toISOString(),
      updatedBy: 'setup-admin-claim-script',
      description: 'Authorized Garba Saathi administrator accounts',
    }, { merge: true });

    console.log('✅ Firestore Admin Registry (/config/admins) updated successfully!');
    console.log(`   └─ Registered Admin Emails: ${currentEmails.join(', ')}`);
    if (currentUids.length) {
      console.log(`   └─ Registered Admin UIDs: ${currentUids.join(', ')}`);
    }
  } catch (fsErr: any) {
    console.error('❌ Failed to update Firestore /config/admins registry:', fsErr.message || fsErr);
  }

  console.log('\n✨ Admin privilege setup complete!');
  console.log('   Note: Logged in users will see admin features upon token refresh or re-login.\n');
}

setupAdminClaim();
