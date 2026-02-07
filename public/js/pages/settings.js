import { getUserRole, refreshMetaFromSession } from "../auth/authChecker.js";
import showMessage from "../components/toast.js";
import { addCsrfTokenToHeaders } from "../utils/csrf.js";

async function checkAuthentication() {
    try {
        let role = await getUserRole({ refresh: false });
        if (!role) {
            const refreshed = await refreshMetaFromSession();
            role = refreshed?.role || null;
        }
        if (!role) {
            window.location.href = "/login";
            return false;
        }
        return true;
    } catch {
        window.location.href = "/login";
        return false;
    }
}

async function fetchProfile() {
    const res = await fetch("/api/auth/profile");
    if (!res.ok) throw new Error("Failed to load profile");
    const json = await res.json();
    return json?.data || {};
}

function renderSettings(profile) {
    const firstName = profile?.firstName || profile?.first_name || "";
    const lastName = profile?.lastName || profile?.last_name || "";
    const middleName = profile?.middleName || profile?.middle_name || "";

    let name = profile?.name || profile?.full_name || "";
    if (!name && (firstName || lastName)) {
        const parts = [firstName, middleName, lastName].filter(Boolean);
        name = parts.join(" ") || "User";
    }
    const email = profile?.email || "—";
    const mobile = profile?.mobileNumber || profile?.mobile_number || profile?.mobile || "—";

    document.getElementById("profile-name-display").textContent = name;
    document.getElementById("profile-email-display").textContent = email;
    document.getElementById("current-email-display").textContent = email;
    document.getElementById("profile-mobile-display").textContent = mobile;

    const initialEl = document.getElementById("profile-initial");
    if (initialEl && name !== "—") initialEl.textContent = name.charAt(0).toUpperCase();

    // Populate address
    const address = profile?.address || {};
    const addressLine1 = address?.line1 || address?.address_line_1 || "";
    const addressLine2 = address?.line2 || address?.address_line_2 || "";
    const postalCode = address?.postalCode || address?.postal_code || "";
    const barangay = address?.barangay || "";

    document.getElementById("address-line-1-display").textContent = addressLine1 || "—";
    if (addressLine2) {
        document.getElementById("address-line-2-display").textContent = addressLine2;
        document.getElementById("address-line-2-display").style.display = "block";
    }
    document.getElementById("address-postal-display").textContent = postalCode;
    document.getElementById("address-barangay-display").textContent = barangay || "—";

    // Pre-fill inputs
    const fnInput = document.getElementById("edit-first-name-input");
    const mnInput = document.getElementById("edit-middle-name-input");
    const lnInput = document.getElementById("edit-last-name-input");
    if (fnInput) fnInput.value = firstName;
    if (mnInput) mnInput.value = middleName;
    if (lnInput) lnInput.value = lastName;

    const mobInput = document.getElementById("edit-mobile-input");
    if (mobInput) mobInput.value = mobile;

    const addr1Input = document.getElementById("edit-address-line-1");
    const addr2Input = document.getElementById("edit-address-line-2");
    const brgyInput = document.getElementById("edit-address-barangay");
    const postInput = document.getElementById("edit-address-postal");
    if (addr1Input) addr1Input.value = addressLine1;
    if (addr2Input) addr2Input.value = addressLine2;
    if (brgyInput) brgyInput.value = barangay;
    if (postInput) postInput.value = postalCode;
}

function wireTabs() {
    const tabs = document.querySelectorAll(".settings-nav-item");
    const sections = document.querySelectorAll(".settings-section");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const target = tab.getAttribute("data-tab");
            tabs.forEach(t => t.classList.remove("active"));
            sections.forEach(s => s.classList.remove("active"));

            tab.classList.add("active");
            document.getElementById(target).classList.add("active");
        });
    });
}

function wireHandlers() {
    // Name Edit
    const nameView = document.getElementById("name-view");
    const nameEdit = document.getElementById("name-edit");
    const editNameBtn = document.getElementById("edit-name-btn");
    const cancelNameBtn = document.getElementById("cancel-name-btn");

    editNameBtn.onclick = () => {
        nameView.style.display = "none";
        editNameBtn.style.display = "none";
        nameEdit.style.display = "block";
    };

    cancelNameBtn.onclick = () => {
        nameView.style.display = "flex";
        editNameBtn.style.display = "block";
        nameEdit.style.display = "none";
    };

    document.getElementById("save-name-btn").onclick = async () => {
        const fName = document.getElementById("edit-first-name-input").value.trim();
        const mName = document.getElementById("edit-middle-name-input").value.trim();
        const lName = document.getElementById("edit-last-name-input").value.trim();

        try {
            const res = await fetch("/api/auth/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ first_name: fName, middle_name: mName, last_name: lName }),
            });
            if (!res.ok) throw new Error("Update failed");
            showMessage("success", "Name updated");
            const parts = [fName, mName, lName].filter(Boolean);
            document.getElementById("profile-name-display").textContent = parts.join(" ");
            cancelNameBtn.click();
        } catch (err) {
            showMessage("error", err.message);
        }
    };

    // Mobile Edit
    const mobileView = document.getElementById("mobile-view");
    const mobileEdit = document.getElementById("mobile-edit");
    const editMobileBtn = document.getElementById("edit-mobile-btn");
    const cancelMobileBtn = document.getElementById("cancel-mobile-btn");

    editMobileBtn.onclick = () => {
        mobileView.style.display = "none";
        editMobileBtn.style.display = "none";
        mobileEdit.style.display = "block";
    };

    cancelMobileBtn.onclick = () => {
        mobileView.style.display = "flex";
        editMobileBtn.style.display = "block";
        mobileEdit.style.display = "none";
    };

    document.getElementById("save-mobile-btn").onclick = async () => {
        const mobile = document.getElementById("edit-mobile-input").value.trim();
        try {
            const res = await fetch("/api/auth/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mobile_number: mobile }),
            });
            if (!res.ok) throw new Error("Update failed");
            showMessage("success", "Mobile number updated");
            document.getElementById("profile-mobile-display").textContent = mobile;
            cancelMobileBtn.click();
        } catch (err) {
            showMessage("error", err.message);
        }
    };

    // Address Edit
    const addressView = document.getElementById("address-view");
    const addressEdit = document.getElementById("address-edit");
    const editAddressBtn = document.getElementById("edit-address-btn");
    const cancelAddressBtn = document.getElementById("cancel-address-btn");

    editAddressBtn.onclick = () => {
        addressView.style.display = "none";
        editAddressBtn.style.display = "none";
        addressEdit.style.display = "block";
    };

    cancelAddressBtn.onclick = () => {
        addressView.style.display = "block";
        editAddressBtn.style.display = "block";
        addressEdit.style.display = "none";
    };

    document.getElementById("save-address-btn").onclick = async () => {
        const line1 = document.getElementById("edit-address-line-1").value.trim();
        const line2 = document.getElementById("edit-address-line-2").value.trim();
        const barangay = document.getElementById("edit-address-barangay").value.trim();
        const postal = document.getElementById("edit-address-postal").value.trim();

        try {
            const res = await fetch("/api/auth/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ address: { line1, line2, barangay, postal_code: postal } }),
            });
            if (!res.ok) throw new Error("Update failed");
            showMessage("success", "Address updated");
            document.getElementById("address-line-1-display").textContent = line1;
            document.getElementById("address-line-2-display").textContent = line2;
            document.getElementById("address-line-2-display").style.display = line2 ? "block" : "none";
            document.getElementById("address-barangay-display").textContent = barangay;
            document.getElementById("address-postal-display").textContent = postal;
            cancelAddressBtn.click();
        } catch (err) {
            showMessage("error", err.message);
        }
    };

    // Password Change
    document.getElementById("change-password-form").onsubmit = async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById("current-password").value;
        const newPassword = document.getElementById("new-password").value;
        const confirmPassword = document.getElementById("confirm-new-password").value;

        if (newPassword !== confirmPassword) {
            return showMessage("error", "Passwords do not match");
        }

        try {
            const headers = await addCsrfTokenToHeaders({ "Content-Type": "application/json" });
            const res = await fetch("/api/auth/request-password-change", {
                method: "POST",
                headers,
                body: JSON.stringify({ currentPassword }),
            });
            if (!res.ok) throw new Error("Request failed");
            showMessage("success", "Confirmation email sent. Check your inbox.");
            e.target.reset();
        } catch (err) {
            showMessage("error", err.message);
        }
    };

    // Email Change Modal
    const emailModal = document.getElementById("email-change-modal");
    const editEmailBtn = document.getElementById("edit-email-btn");
    const closeEmailModal = document.getElementById("close-email-modal");
    const cancelEmailModal = document.getElementById("cancel-email-modal");

    editEmailBtn.onclick = () => {
        emailModal.removeAttribute("style");
        emailModal.style.display = "flex";
        emailModal.style.visibility = "visible";
        emailModal.style.opacity = "1";
        emailModal.style.zIndex = "10002";
    };

    const hideEmailModal = () => {
        emailModal.style.display = "none";
        emailModal.style.visibility = "hidden";
    };

    closeEmailModal.onclick = hideEmailModal;
    cancelEmailModal.onclick = hideEmailModal;

    document.getElementById("email-change-form").onsubmit = async (e) => {
        e.preventDefault();
        const newEmail = document.getElementById("new-email-input").value;
        const currentPassword = document.getElementById("current-password-email").value;

        try {
            const headers = await addCsrfTokenToHeaders({ "Content-Type": "application/json" });
            const res = await fetch("/api/auth/request-email-change", {
                method: "POST",
                headers,
                body: JSON.stringify({ newEmail, currentPassword }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Request failed");
            showMessage("success", "Email change request sent. Check your new email inbox.");
            hideEmailModal();
        } catch (err) {
            showMessage("error", err.message);
        }
    };
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!(await checkAuthentication())) return;
    try {
        const profile = await fetchProfile();
        renderSettings(profile);
        wireTabs();
        wireHandlers();
    } catch (error) {
        showMessage("error", "Failed to load settings");
    }
});
