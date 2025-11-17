import { db } from './firebase.js';
import { ref, remove, get, onValue, update } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
import { loadBorrowers } from './borrower_users.js';

document.addEventListener("DOMContentLoaded", () => {

    // -------------------- DOM Elements --------------------
    const deleteModal = document.getElementById("deleteBorrowerModal");
    const deleteMessage = document.getElementById("deleteBorrowerModalMessage");
    const deleteConfirmBtn = document.getElementById("deleteConfirmYes");
    const deleteCloseBtns = document.querySelectorAll('[data-close-modal="deleteBorrowerModal"]');

    const successModal = document.getElementById("successModal");
    const successMessage = document.getElementById("successModalMessage");
    const successCloseBtns = document.querySelectorAll('[data-close-modal="successModal"]');

    let selectedBorrowerId = null;

    const openModal = () => deleteModal.style.display = "flex";
    const closeModal = () => deleteModal.style.display = "none";
    const showSuccess = (msg) => { successMessage.textContent = msg; successModal.style.display = "flex"; };

    deleteCloseBtns.forEach(btn => btn.onclick = closeModal);
    successCloseBtns.forEach(btn => btn.onclick = () => successModal.style.display = "none");

    // -------------------- Load Borrow History --------------------
    let allHistory = {};
    const historyRef = ref(db, "borrow_history");
    onValue(historyRef, (snapshot) => {
        allHistory = snapshot.val() || {};
    });

    // -------------------- Check Active Borrows --------------------
    function hasActiveBorrower(borrowerId) {
        return Object.values(allHistory).some(history =>
            history.borrower_id === borrowerId &&
            (!history.return_date || history.return_date.trim() === "")
        );
    }

    // -------------------- Listen for Delete Button --------------------
    document.addEventListener("openDeleteBorrowerModal", (e) => {
        selectedBorrowerId = e.detail.borrowerId;
        if (!selectedBorrowerId) return;

        if (hasActiveBorrower(selectedBorrowerId)) {
            deleteMessage.textContent = "Cannot delete borrower: currently has borrowed books.";
            deleteConfirmBtn.disabled = true;
            deleteConfirmBtn.style.background = "gray";
            deleteConfirmBtn.style.cursor = "not-allowed";
        } else {
            deleteMessage.textContent = "Are you sure you want to delete this borrower? This action cannot be undone.";
            deleteConfirmBtn.disabled = false;
            deleteConfirmBtn.style.background = "";
            deleteConfirmBtn.style.cursor = "pointer";
        }

        openModal();
    });

    // --------------------------------------------------------------------
    // 🔵 NEW FUNCTION: Delete history entries for this borrower
    // --------------------------------------------------------------------
    async function deleteBorrowHistoryForBorrower(borrowerId) {
        const updates = {};

        Object.entries(allHistory).forEach(([historyKey, historyVal]) => {
            if (historyVal.borrower_id === borrowerId) {
                updates[`borrow_history/${historyKey}`] = null; // delete this history
            }
        });

        // Only run update if there is something to delete
        if (Object.keys(updates).length > 0) {
            await update(ref(db), updates);
        }
    }

    // -------------------- Confirm Delete --------------------
    deleteConfirmBtn.addEventListener("click", async () => {
        if (!selectedBorrowerId) return;

        try {
            // 🔵 NEW: Delete all related borrow history first
            await deleteBorrowHistoryForBorrower(selectedBorrowerId);

            // Delete the borrower itself
            await remove(ref(db, "borrower/" + selectedBorrowerId));

            closeModal();
            loadBorrowers();
            showSuccess("Borrower and related borrow history removed successfully!");
            selectedBorrowerId = null;

        } catch (err) {
            console.error(err);
            closeModal();
            showSuccess("Error deleting borrower: " + err.message);
        }
    });

});
