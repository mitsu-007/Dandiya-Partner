import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const configDbId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
const db = configDbId ? getFirestore(app, configDbId) : getFirestore(app);

async function migrateLegacyRequests() {
  console.log('🔄 Starting migration of legacy request documents...');
  try {
    const requestsSnap = await getDocs(collection(db, 'requests'));
    console.log(`📋 Found ${requestsSnap.size} total request documents in Firestore.`);

    let migratedCount = 0;
    const batch = writeBatch(db);

    requestsSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      let needsUpdate = false;
      const updates: Record<string, any> = {};

      // Preserve identities: fill missing canonical fields if legacy field exists
      const effectiveSenderUid = data.senderUid || data.senderId;
      const effectiveRecipientUid = data.recipientUid || data.receiverId;

      if (effectiveSenderUid) {
        if (!data.senderUid) {
          updates.senderUid = effectiveSenderUid;
          needsUpdate = true;
        }
        if (!data.senderId) {
          updates.senderId = effectiveSenderUid;
          needsUpdate = true;
        }
      }

      if (effectiveRecipientUid) {
        if (!data.recipientUid) {
          updates.recipientUid = effectiveRecipientUid;
          needsUpdate = true;
        }
        if (!data.receiverId) {
          updates.receiverId = effectiveRecipientUid;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        console.log(`  └─ Queuing update for request [${docSnap.id}]:`, updates);
        batch.update(doc(db, 'requests', docSnap.id), updates);
        migratedCount++;
      }
    });

    if (migratedCount > 0) {
      console.log(`💾 Committing batch updates for ${migratedCount} documents...`);
      await batch.commit();
      console.log(`✅ Successfully migrated ${migratedCount} legacy request documents!`);
    } else {
      console.log('✨ All request documents already contain canonical senderUid and recipientUid fields!');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

migrateLegacyRequests();
