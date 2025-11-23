// book_tracking.js
import { db } from "./firebase.js";
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

export function startLocationTracking() {
  let readersData = {};
  let bookUnitsData = {};
  let metasData = {};

  const lastDetectedTime = {};   // timestamp of last detection
  const lastShelfSeenOn = {};    // last actual shelf (even if misplaced)

  // -------------------- REAL-TIME LISTENERS --------------------
  onValue(ref(db, "readers"), (snapshot) => {
    readersData = snapshot.val() || {};
    updateLocations();
  });

  onValue(ref(db, "book_unit"), (snapshot) => {
    bookUnitsData = snapshot.val() || {};
    updateLocations();
  });

  onValue(ref(db, "book_metadata"), (snapshot) => {
    metasData = snapshot.val() || {};
  });

  // -------------------- UPDATE LOCATIONS --------------------
  function updateLocations() {
    if (!bookUnitsData || !readersData) return;

    const now = Date.now();
    const GRACE_PERIOD = 10 * 1000; // 10 seconds

    Object.entries(bookUnitsData).forEach(([bookUID, bookInfo]) => {
      const tagUID = bookInfo.tag_uid;
      let newLocation = "Not Found";
      let found = false;

      // -------------------- DETECT BOOK LOCATION --------------------
      if (tagUID) {
        for (const [readerId, readerInfo] of Object.entries(readersData)) {
          // Case 1: multiple tag_uids
          if (readerInfo.tag_uids && Object.values(readerInfo.tag_uids).includes(tagUID)) {
            newLocation = readerInfo.location || readerId;
            found = true;
            break;
          }
          // Case 2: single tag_uid
          if (readerInfo.tag_uid && readerInfo.tag_uid === tagUID) {
            newLocation = readerInfo.location || readerId;
            found = true;
            break;
          }
        }
      }

      const updatesObj = {};

      // -------------------- BOOK DETECTED --------------------
      if (found) {
        // Previous shelf before this detection
        const previousLoc = lastShelfSeenOn[bookUID] || bookInfo.location || "Unknown";

        // Update location to current detected shelf
        updatesObj.location = newLocation;

        // Set last_seen to the previous shelf, not the new one
        updatesObj.last_seen = previousLoc;

        // Update detection timestamp
        lastDetectedTime[bookUID] = now;

        // Only update lastShelfSeenOn if previous location was valid (not "Not Found")
        if (bookInfo.location && bookInfo.location !== "Not Found") {
          lastShelfSeenOn[bookUID] = bookInfo.location;
        } else if (!lastShelfSeenOn[bookUID]) {
          // Initialize if first detection
          lastShelfSeenOn[bookUID] = newLocation;
        }
      }

// -------------------- BOOK NOT DETECTED --------------------
if (!found) {
  const meta = metasData[bookInfo.metadata_id] || {};
  const preferredLoc = meta.preferred_location || "Unknown";

  // Location is Not Found or Borrowed depending on status
  updatesObj.location = bookInfo.status === "Not Available" ? "Borrowed" : "Not Found";

  // last_seen should always remain the last actual shelf, even if misplaced
  // Initialize lastShelfSeenOn if it hasn't been set yet
  if (!lastShelfSeenOn[bookUID]) {
    lastShelfSeenOn[bookUID] = bookInfo.location && bookInfo.location !== "Not Found"
      ? bookInfo.location
      : preferredLoc;
  }

  updatesObj.last_seen = lastShelfSeenOn[bookUID];
}



      // -------------------- UPDATE DATABASE --------------------
      if (Object.keys(updatesObj).length > 0) {
        update(ref(db, `book_unit/${bookUID}`), updatesObj);
      }
    });
  }
}
