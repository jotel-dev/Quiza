import "dotenv/config";
import { google } from "googleapis";

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
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const serviceusage = google.serviceusage({ version: 'v1', auth });

    const res = await serviceusage.services.enable({
      name: `projects/${serviceAccount.project_id}/services/firestore.googleapis.com`,
    });

    console.log("Successfully enabled Firestore API:", res.data);
  } catch (e) {
    console.error("Failed to enable API:", e.response?.data || e.message);
  }
}

run();
