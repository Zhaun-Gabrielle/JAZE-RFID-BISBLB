// auto_reader_status.js
import { db } from './firebase.js';
import { ref, get, update } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

const OFFLINE_THRESHOLD_MS = 30 * 1000; // 30 seconds

async function updateReaderStatus() {
  try {
    // Get zulu_time from database
    const zuluSnapshot = await get(ref(db, 'zulu_time'));
    if (!zuluSnapshot.exists()) return;

    const zuluTimeStr = zuluSnapshot.val();
    const referenceTime = new Date(zuluTimeStr);
    if (isNaN(referenceTime.getTime())) return;

    // Get all readers
    const snapshot = await get(ref(db, 'readers'));
    if (!snapshot.exists()) return;

    const readers = snapshot.val();
    const updates = {};

    for (const readerNo in readers) {
      const reader = readers[readerNo];
      const lastUpdate = reader?.last_update;
      const currentStatus = reader?.status || "Offline";

      // If no timestamp or blank -> Offline
      if (!lastUpdate || lastUpdate.trim() === "") {
        if (currentStatus !== "Offline") {
          updates[`readers/${readerNo}/status`] = "Offline";
        }
        continue;
      }

      // Compare last_update to zulu_time
      const lastSeen = new Date(lastUpdate);
      if (isNaN(lastSeen.getTime())) {
        if (currentStatus !== "Offline") {
          updates[`readers/${readerNo}/status`] = "Offline";
        }
        continue;
      }

      const diffMs = referenceTime - lastSeen;
      const newStatus = diffMs > OFFLINE_THRESHOLD_MS ? "Offline" : "Online";

      // Only update if the status actually changed
      if (currentStatus !== newStatus) {
        updates[`readers/${readerNo}/status`] = newStatus;
      }
    }

    // Apply updates in one batch (only if something changed)
    if (Object.keys(updates).length > 0) {
      await update(ref(db), updates);
    }

  } catch (error) {
    console.error("❌ Error updating reader statuses:", error);
  }
}

/* ---------------------------------------------------------
   ⏱️ Run automatically every 10 seconds
--------------------------------------------------------- */
updateReaderStatus(); // Run immediately
setInterval(updateReaderStatus, 10 * 1000); // Repeat every 10s
