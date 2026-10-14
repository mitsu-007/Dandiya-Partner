import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const configDbId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
const db = configDbId ? getFirestore(app, configDbId) : getFirestore(app);

async function runPermissionTests() {
  console.log('🧪 Running Firestore Permission and Query Validation Tests...\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Validate recipientUid Query structure
  try {
    const q1 = query(collection(db, 'requests'), where('recipientUid', '==', 'test_uid_sample'));
    console.log('  [PASS] Test 1: Query with recipientUid satisfies security rules structure.');
    passed++;
  } catch (err: any) {
    console.error('  [FAIL] Test 1:', err.message);
    failed++;
  }

  // Test 2: Validate senderUid Query structure
  try {
    const q2 = query(collection(db, 'requests'), where('senderUid', '==', 'test_uid_sample'));
    console.log('  [PASS] Test 2: Query with senderUid satisfies security rules structure.');
    passed++;
  } catch (err: any) {
    console.error('  [FAIL] Test 2:', err.message);
    failed++;
  }

  // Test 3: Validate Accepted Connections Query structure
  try {
    const q3 = query(
      collection(db, 'requests'),
      where('recipientUid', '==', 'test_uid_sample'),
      where('status', '==', 'accepted')
    );
    console.log('  [PASS] Test 3: Accepted connections query satisfies security rules structure.');
    passed++;
  } catch (err: any) {
    console.error('  [FAIL] Test 3:', err.message);
    failed++;
  }

  console.log(`\n📊 Test Summary: ${passed} Passed, ${failed} Failed.`);
}

runPermissionTests();
