import "dotenv/config";
import { google } from "googleapis";

/**
 * Initializes and creates the default Firestore database if it doesn't exist
 */
async function run() {
  try {
    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
    const serviceAccount = JSON.parse(serviceAccountStr);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/datastore'],
    });

    const firestore = google.firestore({ version: 'v1', auth });

    console.log("Creating default database...");
    const res = await firestore.projects.databases.create({
      parent: `projects/${serviceAccount.project_id}`,
      databaseId: '(default)',
      requestBody: {
        type: 'FIRESTORE_NATIVE',
        locationId: 'nam5', // us-central is nam5
      }
    });

    console.log("Successfully created database:", res.data);
  } catch (e) {
    console.error("Failed to create database:", e.response?.data || e.message);
  }
}

run();
