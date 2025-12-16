import { supabase } from "../config/config.js";

// ID Verification: upload/camera capture and OCR for identity verification
// Expected OCR API response shape (example):
// {
//   fields: {
//     firstName: "...",
//     lastName: "...",
//     middleName: "...",
//     addressLine1: "...",
//     addressLine2: "...",
//     barangay: "...",
//     sex: "Male|Female|M|F",
//     idNumber: "...",
//     birthDate: "YYYY-MM-DD",
//     expiryDate: "YYYY-MM-DD"
//   },
//   rawText: "...",
//   provider: "textract|vision|tesseract|custom"
// }
// Note: Extracted fields are displayed for verification purposes only, not for form autofill

(function () {
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const container = qs("#id-step-placeholder");
  if (!container) return;

  const modeBtns = qsa(".id-mode-btn");
  const uploadPanel = qs('[data-mode-panel="upload"]');
  const cameraPanel = qs('[data-mode-panel="camera"]');

  const fileInput = qs("#id-file-input");
  const previewWrap = qs("#id-preview");
  const previewImg = qs("#id-preview-img");
  const clearBtn = qs("#id-clear-btn");

  const cameraVideo = qs("#id-camera");
  const cameraCanvas = qs("#id-canvas");
  const cameraStartBtn = qs("#camera-start-btn");
  const cameraCaptureBtn = qs("#camera-capture-btn");
  const cameraStopBtn = qs("#camera-stop-btn");
  const cameraPreviewWrap = qs("#id-camera-preview");
  const cameraPreviewImg = qs("#id-captured-img");
  const cameraRetakeBtn = qs("#camera-retake-btn");

  const consent = qs("#id-consent-checkbox");
  const scanBtn = qs("#id-scan-btn");
  const statusEl = qs("#id-verify-status");
  const review = qs("#id-review");
  const reviewGrid = qs("#id-review-grid");

  const form = qs("#regForm") || qs("#oauthCompleteForm");

  let mediaStream = null;
  let capturedBlob = null;
  let isStartingCamera = false; // Prevent multiple simultaneous start attempts
  let lastCameraError = null;
  let cameraErrorCount = 0;
  let cameraCooldownUntil = 0; // Timestamp when camera can be retried
  let extractedIdData = null; // Store extracted ID data for comparison

  function setMode(mode) {
    modeBtns.forEach((b) => {
      const active = b.dataset.mode === mode;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
    });
    const isUpload = mode === "upload";
    uploadPanel.hidden = !isUpload;
    cameraPanel.hidden = isUpload;
    if (!isUpload) {
      previewWrap.hidden = true;
      fileInput.value = "";
      // Don't auto-start - let user explicitly click "Enable camera" button
      // This prevents permission issues and race conditions
    } else {
      stopCamera();
      cameraPreviewWrap.hidden = true;
      capturedBlob = null;
    }
    updateScanEnabled();
  }

  function updateScanEnabled() {
    const hasUpload = Boolean(fileInput.files?.[0]);
    const hasCapture = Boolean(capturedBlob);
    const ok = consent.checked && (hasUpload || hasCapture);
    scanBtn.disabled = !ok;
  }

  // Upload handling
  fileInput?.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (!f) {
      previewWrap.hidden = true;
      previewImg.src = "";
      return updateScanEnabled();
    }
    // Preview if image
    if (f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      previewImg.src = url;
      previewWrap.hidden = false;
    } else {
      previewWrap.hidden = true;
      previewImg.src = "";
    }
    updateScanEnabled();
  });

  clearBtn?.addEventListener("click", () => {
    fileInput.value = "";
    previewWrap.hidden = true;
    previewImg.src = "";
    updateScanEnabled();
  });

  // Camera handling
  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      status(
        "Camera not supported on this device. Please use Upload mode.",
        "error"
      );
      return;
    }

    // Check cooldown period
    const now = Date.now();
    if (now < cameraCooldownUntil) {
      const secondsLeft = Math.ceil((cameraCooldownUntil - now) / 1000);
      status(
        `Please wait ${secondsLeft} second${
          secondsLeft > 1 ? "s" : ""
        } before trying again.`,
        "info"
      );
      return;
    }

    // Prevent multiple simultaneous start attempts
    if (isStartingCamera) {
      status("Camera is already starting. Please wait...", "info");
      return;
    }

    // Stop any existing camera stream first
    if (mediaStream) {
      stopCamera();
      // Wait longer for cleanup to ensure resources are released
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    isStartingCamera = true;

    try {
      cameraStartBtn.disabled = true;
      status("Requesting camera access...", "info");

      // Strategy: Try simplest constraints first, then progressively more specific
      // This avoids NotReadableError from overly complex constraints
      let mediaStreamAttempt = null;
      let lastError = null;

      // Attempt 1: Absolute simplest - just request any video
      try {
        status("Checking camera availability...", "info");
        mediaStreamAttempt = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        console.log("Camera access granted with simple constraints");
      } catch (simpleError) {
        lastError = simpleError;
        console.log(
          "Simple constraints failed, trying rear camera...",
          simpleError.name
        );

        // Attempt 2: Try rear camera (environment) with minimal constraints
        await new Promise((resolve) => setTimeout(resolve, 300));
        try {
          mediaStreamAttempt = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false,
          });
          console.log("Camera access granted with rear camera");
        } catch (rearError) {
          lastError = rearError;
          console.log(
            "Rear camera failed, trying any camera with basic constraints...",
            rearError.name
          );

          // Attempt 3: Any camera with basic quality
          await new Promise((resolve) => setTimeout(resolve, 300));
          try {
            mediaStreamAttempt = await navigator.mediaDevices.getUserMedia({
              video: { width: 640, height: 480 },
              audio: false,
            });
            console.log("Camera access granted with basic constraints");
          } catch (basicError) {
            lastError = basicError;
            console.log("All camera attempts failed", basicError.name);
            throw basicError; // Re-throw to be caught by outer catch
          }
        }
      }

      mediaStream = mediaStreamAttempt;

      // Success - reset error tracking
      cameraErrorCount = 0;
      lastCameraError = null;

      cameraVideo.srcObject = mediaStream;
      const cameraWrap = cameraVideo.closest(".camera-wrap");

      // Wait for video to be ready
      const onVideoReady = () => {
        cameraVideo.classList.add("ready");
        if (cameraWrap) cameraWrap.classList.add("active");
        cameraCaptureBtn.disabled = false;
        cameraStopBtn.disabled = false;
        status(
          "Camera ready. Position your ID in the frame and click Capture.",
          "success"
        );
      };

      cameraVideo.addEventListener("loadedmetadata", onVideoReady, {
        once: true,
      });
      cameraVideo.addEventListener("playing", onVideoReady, { once: true });

      cameraVideo.play().catch((err) => {
        console.warn("Video play error:", err);
        // Still enable capture if metadata is loaded
        if (cameraVideo.videoWidth > 0) {
          onVideoReady();
        }
      });

      cameraStartBtn.disabled = false;
      isStartingCamera = false;
    } catch (e) {
      console.error("Camera error:", e);
      isStartingCamera = false;
      cameraStartBtn.disabled = false;

      // Clean up any partial stream directly (don't call stopCamera to avoid recursion)
      if (mediaStream) {
        mediaStream.getTracks().forEach((t) => {
          t.stop();
          t.enabled = false;
        });
        mediaStream = null;
      }
      if (cameraVideo) {
        cameraVideo.srcObject = null;
        cameraVideo.classList.remove("ready");
        const cameraWrap = cameraVideo.closest(".camera-wrap");
        if (cameraWrap) cameraWrap.classList.remove("active");
      }

      let errorMsg = "Unable to access camera. ";
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        errorMsg +=
          "Please allow camera permissions in your browser settings and try again.";
      } else if (
        e.name === "NotFoundError" ||
        e.name === "DevicesNotFoundError"
      ) {
        errorMsg += "No camera found. Please use Upload mode instead.";
      } else if (
        e.name === "NotReadableError" ||
        e.name === "TrackStartError"
      ) {
        cameraErrorCount++;
        lastCameraError = e.name;

        // Implement exponential backoff: 3s, 6s, 10s, then suggest upload mode
        const cooldownSeconds =
          cameraErrorCount === 1 ? 3 : cameraErrorCount === 2 ? 6 : 10;
        cameraCooldownUntil = Date.now() + cooldownSeconds * 1000;

        errorMsg = "Camera cannot be accessed. ";

        if (cameraErrorCount === 1) {
          errorMsg +=
            "This usually means the camera is being used by another application. ";
          errorMsg +=
            "Please close Zoom, Teams, Skype, Discord, or other video apps, then wait 3 seconds and try again.";
        } else if (cameraErrorCount === 2) {
          errorMsg += "The camera is still unavailable. ";
          errorMsg +=
            "Please check: (1) Close all video apps, (2) Close other browser tabs using camera, (3) Restart your browser. ";
          errorMsg +=
            "Wait 6 seconds before trying again, or use Upload mode instead.";
        } else {
          errorMsg += "Camera access failed multiple times. ";
          errorMsg +=
            "Please use Upload mode to continue, or restart your computer and try again.";
          // After 3 failures, suggest switching to upload mode
          setTimeout(() => {
            const uploadBtn = Array.from(modeBtns).find(
              (b) => b.dataset.mode === "upload"
            );
            if (uploadBtn) {
              status(
                '💡 Tip: Switch to "Upload" mode to continue without camera.',
                "info"
              );
              // Highlight the upload button
              uploadBtn.style.border = "2px solid var(--info-500)";
              uploadBtn.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.2)";
              setTimeout(() => {
                uploadBtn.style.border = "";
                uploadBtn.style.boxShadow = "";
              }, 5000);
            }
          }, 2000);
        }

        // Disable button during cooldown
        cameraStartBtn.disabled = true;
        const cooldownTimer = setInterval(() => {
          const remaining = Math.ceil(
            (cameraCooldownUntil - Date.now()) / 1000
          );
          if (remaining > 0) {
            status(
              `Please wait ${remaining} second${remaining > 1 ? "s" : ""}...`,
              "info"
            );
          } else {
            clearInterval(cooldownTimer);
            cameraStartBtn.disabled = false;
            if (cameraErrorCount <= 2) {
              status('You can try clicking "Enable camera" again now.', "info");
            } else {
              status("Consider using Upload mode instead.", "info");
            }
          }
        }, 1000);

        // Clear timer after cooldown
        setTimeout(
          () => clearInterval(cooldownTimer),
          cooldownSeconds * 1000 + 100
        );
      } else if (
        e.name === "OverconstrainedError" ||
        e.name === "ConstraintNotSatisfiedError"
      ) {
        errorMsg +=
          "Camera does not support the requested settings. Trying with basic settings...";
        // Try again with minimal constraints
        setTimeout(async () => {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
            cameraVideo.srcObject = mediaStream;
            cameraVideo.play();
            status("Camera started with basic settings.", "success");
          } catch (retryError) {
            status(
              "Could not start camera. Please use Upload mode instead.",
              "error"
            );
          }
        }, 1000);
      } else {
        errorMsg += "Please use Upload mode or check your camera settings.";
      }
      status(errorMsg, "error");
    }
  }

  function stopCamera() {
    isStartingCamera = false; // Reset flag to allow restart

    if (mediaStream) {
      // Stop all tracks more thoroughly
      const tracks = mediaStream.getTracks();
      tracks.forEach((t) => {
        t.stop();
        t.enabled = false;
      });
      // Clear the stream
      mediaStream = null;
    }
    if (cameraVideo) {
      // Pause video first
      cameraVideo.pause();
      cameraVideo.srcObject = null;
      cameraVideo.classList.remove("ready");
      const cameraWrap = cameraVideo.closest(".camera-wrap");
      if (cameraWrap) cameraWrap.classList.remove("active");
    }
    cameraCaptureBtn.disabled = true;
    cameraStopBtn.disabled = false; // Allow restart
  }

  cameraStartBtn?.addEventListener("click", startCamera);
  cameraStopBtn?.addEventListener("click", () => {
    stopCamera();
    status("Camera stopped");
  });

  cameraCaptureBtn?.addEventListener("click", () => {
    if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) {
      status(
        "Camera not ready. Please wait for the camera to initialize.",
        "error"
      );
      return;
    }

    try {
      const w = cameraVideo.videoWidth;
      const h = cameraVideo.videoHeight;
      cameraCanvas.width = w;
      cameraCanvas.height = h;
      const ctx = cameraCanvas.getContext("2d");

      // Draw the video frame to canvas
      ctx.drawImage(cameraVideo, 0, 0, w, h);

      // Convert to blob
      cameraCanvas.toBlob(
        (blob) => {
          if (!blob) {
            status("Failed to capture image. Please try again.", "error");
            return;
          }

          capturedBlob = blob;
          const url = URL.createObjectURL(blob);
          cameraPreviewImg.src = url;
          cameraPreviewWrap.hidden = false;

          // Stop camera after capture to save resources
          stopCamera();

          updateScanEnabled();
          status(
            "Image captured successfully! You may proceed to verify your ID.",
            "success"
          );
        },
        "image/jpeg",
        0.92
      ); // Slightly lower quality for smaller file size
    } catch (err) {
      console.error("Capture error:", err);
      status("Failed to capture image. Please try again.", "error");
    }
  });

  cameraRetakeBtn?.addEventListener("click", () => {
    if (cameraPreviewImg.src) {
      URL.revokeObjectURL(cameraPreviewImg.src);
    }
    capturedBlob = null;
    cameraPreviewImg.src = "";
    cameraPreviewWrap.hidden = true;
    updateScanEnabled();
    // Restart camera for retake
    if (cameraPanel && !cameraPanel.hidden) {
      startCamera();
    }
  });

  // Mode toggle
  modeBtns.forEach((btn) =>
    btn.addEventListener("click", () => setMode(btn.dataset.mode))
  );

  consent?.addEventListener("change", updateScanEnabled);

  // Scan and verify ID
  scanBtn?.addEventListener("click", async () => {
    const usingUpload = !uploadPanel.hidden;
    const file = usingUpload ? fileInput.files?.[0] : null;
    const blob = usingUpload ? file : capturedBlob;
    if (!blob) return;

    scanBtn.disabled = true;

    // Start timer for elapsed time
    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      status(`Processing ID… This may take a few seconds. (${elapsed}s)`);
    }, 1000);

    status("Processing ID… This may take a few seconds. (0s)");

    try {
      const fd = new FormData();
      fd.append("file", blob, (file && file.name) || "capture.jpg");
      const res = await fetch("/api/identity/ocr", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      // Handle error responses from OCR service
      if (!res.ok || !data.success) {
        const errorCode = data.error || "UNKNOWN_ERROR";
        let errorMessage =
          data.message || "Could not process the ID automatically.";

        // Provide specific error messages based on error type
        if (
          errorCode === "TEXT_DETECTION_FAILED" ||
          errorCode === "NO_FIELDS_EXTRACTED"
        ) {
          errorMessage = data.message || "Text detection failed. ";
          if (data.details && data.details.suggestions) {
            errorMessage += `\n\nSuggestions:\n${data.details.suggestions
              .map((s, i) => `${i + 1}. ${s}`)
              .join("\n")}`;
          } else {
            errorMessage +=
              "This may be due to poor image quality, blur, or camera issues. Please try again with a clearer image.";
          }
        } else if (res.status === 400) {
          errorMessage =
            data.message ||
            "Invalid image. Please ensure the image is clear and readable.";
        } else if (res.status >= 500) {
          errorMessage =
            "Server error occurred while processing the ID. Please try again later.";
        }

        status(errorMessage, "error");
        console.error("OCR error:", {
          code: errorCode,
          message: data.message,
          details: data.details,
        });
        return;
      }

      // Store extracted ID data
      const rawFields = data?.fields || {};
      extractedIdData = {};

      // Flatten fields if they are objects with value/confidence (Handle new OCR format)
      Object.keys(rawFields).forEach((key) => {
        const val = rawFields[key];
        if (val && typeof val === "object" && val.value !== undefined) {
          extractedIdData[key] = val.value;
        } else {
          extractedIdData[key] = val;
        }
      });

      // Store verification data in backend (only if authenticated)
      try {
        // Get current session token to ensure request is authenticated
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;

        // If no session (e.g. email signup), skip server storage
        if (!token) {
          console.log(
            "[ID_VERIFY] Anonymous user - skipping server storage. Using local verification data."
          );
          // Use a temporary local ID
          sessionStorage.setItem(
            "cl_verification_id",
            `local_verified_${Date.now()}`
          );
          sessionStorage.setItem("cl_verification_complete", "true");

          // Immediate success for anonymous users
          if (typeof window.handleVerificationSuccess === "function") {
            window.handleVerificationSuccess({
              idType: data.idType,
              idNumber:
                extractedIdData.idNumber || extractedIdData.public_id_number,
              ...extractedIdData,
            });
          }

          status("ID Verified successfully.", "success");
          compareWithFormData(extractedIdData);
          return;
        }

        const headers = { "Content-Type": "application/json" };
        headers["Authorization"] = `Bearer ${token}`;

        // Normalize ID number for backend (server expects idNumber)
        if (!extractedIdData.idNumber) {
          extractedIdData.idNumber =
            extractedIdData.public_id_number ||
            extractedIdData.id_number ||
            extractedIdData.IDNumber ||
            extractedIdData.documentNumber ||
            "";
        }

        const storeResponse = await fetch("/api/verification/store", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({
            idType: data.idType,
            fields: extractedIdData, // Use flattened data for backend storage
            confidence: data.confidence,
          }),
        });

        const storeResult = await storeResponse.json();

        if (!storeResponse.ok || !storeResult.success) {
          // Handle session expiry / stale user
          if (storeResponse.status === 401) {
            console.warn(
              "[ID_VERIFY] Session issue during storage (non-fatal):",
              storeResult.error
            );
            // Don't redirect, just warn and proceed
            sessionStorage.setItem(
              "cl_verification_id",
              `local_verified_${Date.now()}`
            );
            sessionStorage.setItem("cl_verification_complete", "true");
            status("ID Verified locally.", "success"); // Suppress warning for smooth UX
          } else if (storeResult.error === "ID_NUMBER_ALREADY_REGISTERED") {
            status("⚠️ This ID number is already registered.", "warning");
            return; // Stop if duplicate
          } else {
            console.error("Failed to store verification:", storeResult);
            status(
              "⚠️ Verification verified locally. Server storage failed.",
              "warning"
            );
          }

          // Call success handler to unlock "Next" button (unless it was a duplicate error)
          if (storeResult.error !== "ID_NUMBER_ALREADY_REGISTERED") {
            if (typeof window.handleVerificationSuccess === "function") {
              window.handleVerificationSuccess({
                idType: data.idType,
                idNumber:
                  extractedIdData.idNumber || extractedIdData.public_id_number,
                ...extractedIdData,
              });
            }
          }
          if (storeResult.error !== "ID_NUMBER_ALREADY_REGISTERED") {
            compareWithFormData(extractedIdData);
          }
          return;
        }

        // Store verification ID for signup
        try {
          sessionStorage.setItem(
            "cl_verification_id",
            storeResult.data.verificationId
          );
          sessionStorage.setItem("cl_verification_complete", "true");
        } catch (storageError) {
          console.warn(
            "Could not store verification ID in session:",
            storageError
          );
        }

        console.log(
          "[ID_VERIFY] Verification stored:",
          storeResult.data.verificationId
        );
        status("ID Verified successfully!", "success");

        // Call success handler
        if (typeof window.handleVerificationSuccess === "function") {
          window.handleVerificationSuccess({
            idType: data.idType,
            idNumber:
              extractedIdData.idNumber || extractedIdData.public_id_number,
            ...extractedIdData,
          });
        }
      } catch (storeError) {
        console.error("Error storing verification:", storeError);
        status(
          "⚠️ Could not save verification data. Please try again.",
          "error"
        );
        return;
      }

      // Success - compare with form data (this will also render the results)
      compareWithFormData(extractedIdData);
    } catch (err) {
      console.error("OCR error", err);
      // Determine if it's a network error, camera issue, or other error
      let errorMessage = "Could not process the ID automatically. ";
      if (
        err.message &&
        (err.message.includes("fetch") || err.message.includes("network"))
      ) {
        errorMessage +=
          "Network error. Please check your connection and try again.";
      } else if (err.message && err.message.includes("camera")) {
        errorMessage +=
          "Camera error detected. Please try using Upload mode instead, or check your camera settings.";
      } else {
        errorMessage +=
          "Please try again with a clearer image or continue with manual verification.";
      }
      status(errorMessage, "error");
    } finally {
      clearInterval(timerInterval);
      scanBtn.disabled = false;
    }
  });

  function renderReview(fields, provider) {
    if (!fields || Object.keys(fields).length === 0) {
      review.hidden = true;
      reviewGrid.innerHTML = "";
      return;
    }

    // Field name mapping for better display
    const fieldLabels = {
      firstName: "First Name",
      lastName: "Last Name",
      middleName: "Middle Name",
      addressLine1: "Address Line 1",
      addressLine2: "Address Line 2",
      barangay: "Barangay",
      sex: "Sex/Gender",
      idNumber: "ID Number",
      birthDate: "Birth Date",
      expiryDate: "Expiry Date",
    };

    // Filter out null/empty values and format entries
    const entries = Object.entries(fields)
      .filter(([k, v]) => v != null && String(v).trim() !== "")
      .map(([k, v]) => {
        const label =
          fieldLabels[k] ||
          k
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase());
        let value = String(v).trim();

        // Format dates if they're in ISO format
        if (
          (k === "birthDate" || k === "expiryDate") &&
          value.match(/^\d{4}-\d{2}-\d{2}$/)
        ) {
          const date = new Date(value);
          value = date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        }

        return { key: k, label, value };
      });

    if (entries.length === 0) {
      review.hidden = true;
      reviewGrid.innerHTML = "";
      return;
    }

    reviewGrid.innerHTML = entries
      .map(({ key, label, value }) => {
        const safeLabel = escapeHtml(label);
        const safeValue = escapeHtml(value);
        return `<div class="kv"><div class="k">${safeLabel}</div><div class="v">${safeValue}</div></div>`;
      })
      .join("");

    review.hidden = false;
  }

  /**
   * Compare extracted ID data with form data
   * Only compares fields that exist in both the ID and the form
   */
  function compareWithFormData(idFields) {
    if (!idFields || Object.keys(idFields).length === 0) {
      // If no ID data, just show extracted fields if any
      if (reviewGrid) {
        renderReview(idFields || {});
      }
      return;
    }

    // Get current form values (check if fields exist in the form)
    const formData = {};
    const formFieldMap = {
      firstName: "#firstName",
      lastName: "#lastName",
      middleName: "#middleName",
      addressLine1: "#addressLine1",
      addressLine2: "#addressLine2",
      barangay: "#barangay",
      gender: "#gender",
    };

    // Only get form values for fields that actually exist in the DOM
    Object.entries(formFieldMap).forEach(([key, selector]) => {
      const element = qs(selector);
      if (element) {
        formData[key] = (element.value || "").trim();
      }
    });

    // Normalize strings for comparison (remove extra spaces, convert to uppercase)
    const normalize = (str) => {
      if (!str) return "";
      return str.replace(/\s+/g, " ").trim().toUpperCase();
    };

    // Compare gender values (handle different formats)
    const normalizeGender = (gender) => {
      if (!gender) return "";
      const g = gender.toLowerCase();
      if (g.startsWith("m") || g === "he" || g === "male") return "MALE";
      if (g.startsWith("f") || g === "she" || g === "female") return "FEMALE";
      return gender.toUpperCase();
    };

    // Compare ID gender with form gender
    const normalizeIdGender = (idGender) => {
      if (!idGender) return "";
      const g = String(idGender).toLowerCase();
      if (g.startsWith("m") || g === "male") return "MALE";
      if (g.startsWith("f") || g === "female") return "FEMALE";
      return String(idGender).toUpperCase();
    };

    // Field mapping: ID field name -> Form field name -> Display name
    const fieldMappings = [
      {
        idField: "firstName",
        formField: "firstName",
        displayName: "First Name",
        type: "name",
        required: true,
      },
      {
        idField: "lastName",
        formField: "lastName",
        displayName: "Last Name",
        type: "name",
        required: true,
      },
      {
        idField: "middleName",
        formField: "middleName",
        displayName: "Middle Name",
        type: "name",
        required: false,
      },
      {
        idField: "addressLine1",
        formField: "addressLine1",
        displayName: "Address",
        type: "address",
        required: false,
      },
      {
        idField: "barangay",
        formField: "barangay",
        displayName: "Barangay",
        type: "address",
        required: false,
      },
      {
        idField: "sex",
        formField: "gender",
        displayName: "Gender",
        type: "gender",
        required: false,
      },
    ];

    // Perform comparisons - only for fields that exist in both ID and form
    const comparisons = [];
    const availableIdFields = Object.keys(idFields).filter(
      (key) => idFields[key] != null && String(idFields[key]).trim() !== ""
    );
    const availableFormFields = Object.keys(formData);

    // Levenshtein distance for fuzzy matching
    const levenshteinDistance = (a, b) => {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;
      const matrix = [];
      for (let i = 0; i <= b.length; i++) matrix[i] = [i];
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
            );
          }
        }
      }
      return matrix[b.length][a.length];
    };

    // Calculate similarity score (0-100)
    const calculateSimilarity = (str1, str2) => {
      const s1 = normalize(str1);
      const s2 = normalize(str2);
      if (!s1 && !s2) return 100;
      if (!s1 || !s2) return 0;
      if (s1 === s2) return 100;

      // Partial Match Check: If one contains the other (and length > 3), it's a match
      if (
        (s1.includes(s2) || s2.includes(s1)) &&
        Math.min(s1.length, s2.length) > 3
      ) {
        return 100;
      }

      const distance = levenshteinDistance(s1, s2);
      const maxLength = Math.max(s1.length, s2.length);
      const similarity = (1 - distance / maxLength) * 100;
      return Math.max(0, Math.min(100, similarity));
    };

    fieldMappings.forEach((mapping) => {
      // Only compare if:
      // 1. The ID has this field
      // 2. The form has this field (element exists in DOM)
      const idHasField = availableIdFields.includes(mapping.idField);
      const formHasField = availableFormFields.includes(mapping.formField);

      if (idHasField && formHasField) {
        const idValue = String(idFields[mapping.idField]).trim();
        const formValue = formData[mapping.formField] || "";

        let match = false;
        let score = 0;

        if (mapping.type === "gender") {
          // Special handling for gender
          const idGender = normalizeIdGender(idValue);
          const formGender = normalizeGender(formValue);
          match = !formValue || idGender === formGender; // Optional field
          score = match ? 100 : 0;
        } else {
          // For names and addresses
          score = calculateSimilarity(idValue, formValue);

          if (!formValue && !mapping.required) {
            // Optional field not entered - consider it a match
            match = true;
            score = 100;
          } else {
            // Enforce 80% threshold
            match = score >= 80;
          }
        }

        comparisons.push({
          field: mapping.displayName,
          idValue,
          formValue: formValue || "(not entered)",
          match,
          score: Math.round(score),
          type: mapping.type,
          required: mapping.required,
        });
      }
    });

    // Track fields that exist in ID but not in form (for information display)
    const idOnlyFields = availableIdFields.filter(
      (idField) =>
        !fieldMappings.some(
          (m) =>
            m.idField === idField && availableFormFields.includes(m.formField)
        )
    );

    // Display results
    displayComparisonResults(comparisons, idOnlyFields);

    // Return result for status message
    return { comparisons, idOnlyFields };

    // Display comparison results
    displayComparisonResults(comparisons);
  }

  /**
   * Display comparison results
   */
  /**
   * Display comparison results
   */
  function displayComparisonResults(comparisons, idOnlyFields = []) {
    // If no comparisons possible, show extracted ID data only
    if (!comparisons || comparisons.length === 0) {
      if (extractedIdData && reviewGrid) {
        let message =
          '<div style="padding: 16px; background: var(--error-50); border: 1px solid var(--error-200); border-radius: 8px; margin-bottom: 20px; text-align: center;">';
        message +=
          '<div style="color: var(--error-700); font-weight: 700; font-size: 1.1rem; margin-bottom: 4px;">Picture is not clear or ID not valid</div>';
        message +=
          '<div style="color: var(--error-600); font-size: 0.9rem;">We could not automatically verify your information. Please ensure the image is clear and you are using a valid PhilSys ID.</div></div>';

        const extractedHtml = renderExtractedFieldsOnly(extractedIdData);
        reviewGrid.innerHTML = message + extractedHtml;
        review.hidden = false;
        status(
          "Picture is not clear or ID not valid. Please try again.",
          "error"
        );
      }
      return;
    }

    // Count matches and mismatches
    const matches = comparisons.filter((c) => c.match).length;
    const mismatches = comparisons.filter((c) => !c.match).length;

    // Check for ID Type validity (must be PhilID/PhilSys)
    const isPhilId =
      extractedIdData?.idType === "philid" ||
      extractedIdData?.idType === "philpost";
    // ^ Assuming philpost is also acceptable or adjust accordingly.
    // If strict PhilSys request:
    // const isPhilId = extractedIdData?.idType === 'philid';

    // Determine overall status
    // Fail if any REQUIRED field is a mismatch
    const failedRequired = comparisons.filter((c) => c.required && !c.match);
    const passed = failedRequired.length === 0 && isPhilId;

    // Build the status HTML message based on specific failure modes
    let statusHtml = "";

    if (passed) {
      statusHtml = `
        <div style="padding: 16px; background: var(--success-50); border: 1px solid var(--success-200); border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <div style="color: var(--success-700); font-weight: 700; font-size: 1.1rem; margin-bottom: 4px;">Identity Confirmed</div>
          <div style="color: var(--success-600); font-size: 0.9rem;">Your ID matches your profile information.</div>
        </div>
      `;
      sessionStorage.setItem("cl_verification_passed", "true");
      status("✓ Identity Confirmed.", "success");
    } else if (!isPhilId) {
      statusHtml = `
        <div style="padding: 16px; background: var(--error-50); border: 1px solid var(--error-200); border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <div style="color: var(--error-700); font-weight: 700; font-size: 1.1rem; margin-bottom: 4px;">ID Not Valid</div>
          <div style="color: var(--error-600); font-size: 0.9rem;">
            Please use only a valid <strong>PhilSys ID</strong> (National ID). Other ID types are not recommended for this verification.
          </div>
        </div>
      `;
      sessionStorage.removeItem("cl_verification_passed");
      status("ID Not Valid. Please use PhilSys ID.", "error");
    } else if (failedRequired.length > 0) {
      // Identity didn't match (mismatches in required fields)
      statusHtml = `
        <div style="padding: 16px; background: var(--error-50); border: 1px solid var(--error-200); border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <div style="color: var(--error-700); font-weight: 700; font-size: 1.1rem; margin-bottom: 4px;">Identity Didn't Match</div>
          <div style="color: var(--error-600); font-size: 0.9rem;">
            The information on your ID does not match the details you provided (${
              failedRequired.length
            } field${failedRequired.length !== 1 ? "s" : ""} mismatched).
            <br>Please review your inputs or ensure the ID belongs to you.
          </div>
        </div>
      `;
      sessionStorage.removeItem("cl_verification_passed");
      status("Identity Didn't Match. Please review your details.", "error");
    } else {
      // Fallback for unclear cases (e.g. low confidence but technically matched optional fields?)
      statusHtml = `
        <div style="padding: 16px; background: var(--warning-50); border: 1px solid var(--warning-200); border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <div style="color: var(--warning-700); font-weight: 700; font-size: 1.1rem; margin-bottom: 4px;">Picture is not clear</div>
          <div style="color: var(--warning-600); font-size: 0.9rem;">
            Some fields could not be confidently verified. Please try uploading a clearer image.
          </div>
        </div>
      `;
      sessionStorage.removeItem("cl_verification_passed");
      status("Picture is not clear. Please try again.", "warning");
    }

    // Update review section with comparison results
    if (reviewGrid) {
      const comparisonHtml = comparisons
        .map((comp) => {
          const matchIcon = comp.match
            ? '<span style="color: var(--success-600); margin-right: 8px;">✓</span>'
            : '<span style="color: var(--error-600); margin-right: 8px;">✗</span>';
          const matchClass = comp.match ? "match" : "mismatch";
          const safeField = escapeHtml(comp.field);
          const safeIdValue = escapeHtml(comp.idValue);
          const safeFormValue = escapeHtml(comp.formValue);
          const scoreDisplay =
            comp.type !== "gender"
              ? `<span style="font-size: 0.8em; color: var(--gray-500); margin-left: auto;">${comp.score}% Match</span>`
              : "";

          return `
          <div class="comparison-item ${matchClass}" style="margin-bottom: 12px; padding: 12px; border-radius: 6px; background: ${
            comp.match ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)"
          }; border-left: 3px solid ${
            comp.match ? "var(--success-600)" : "var(--error-600)"
          };">
            <div style="font-weight: 600; margin-bottom: 8px; display: flex; align-items: center;">
              ${matchIcon}
              <span>${safeField}</span>
              ${scoreDisplay}
            </div>
            <div style="font-size: 0.9rem; color: var(--gray-700); margin-bottom: 4px;">
              <span style="font-weight: 500;">ID:</span> ${safeIdValue}
            </div>
            <div style="font-size: 0.9rem; color: var(--gray-700);">
              <span style="font-weight: 500;">Form:</span> ${safeFormValue}
            </div>
            ${
              !comp.match && comp.type !== "gender"
                ? '<div style="font-size: 0.8rem; color: var(--error-600); margin-top: 4px;">Score below 85% threshold</div>'
                : ""
            }
          </div>
        `;
        })
        .join("");

      // Also show other extracted fields
      const otherFieldsHtml = renderOtherExtractedFields(
        extractedIdData,
        comparisons
      );

      reviewGrid.innerHTML =
        statusHtml +
        comparisonHtml +
        (otherFieldsHtml
          ? `<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--gray-300);"><div style="font-weight: 600; margin-bottom: 12px;">Other ID Information</div>${otherFieldsHtml}</div>`
          : "");

      // Enable the review details now that process is finished
      review.hidden = false;
      review.removeAttribute("disabled");
      const summaryElement = review.querySelector("summary");
      if (summaryElement) {
        summaryElement.classList.remove("review-summary-disabled");
      }
    }
  }

  /**
   * Render other extracted fields that aren't being compared (ID number, dates, etc.)
   */
  function renderOtherExtractedFields(idFields, comparisons) {
    if (!idFields) return "";

    const comparedFields = [
      "firstName",
      "lastName",
      "middleName",
      "addressLine1",
      "barangay",
      "sex",
    ];
    const otherFields = Object.entries(idFields)
      .filter(
        ([key, value]) =>
          !comparedFields.includes(key) &&
          value != null &&
          String(value).trim() !== ""
      )
      .map(([key, value]) => {
        const fieldLabels = {
          idNumber: "ID Number",
          birthDate: "Birth Date",
          expiryDate: "Expiry Date",
          addressLine2: "Address Line 2",
        };
        const label =
          fieldLabels[key] ||
          key
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase());
        let displayValue = String(value).trim();

        // Format dates
        if (
          (key === "birthDate" || key === "expiryDate") &&
          displayValue.match(/^\d{4}-\d{2}-\d{2}$/)
        ) {
          const date = new Date(displayValue);
          displayValue = date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        }

        return { label, value: displayValue };
      });

    if (otherFields.length === 0) return "";

    return otherFields
      .map(({ label, value }) => {
        const safeLabel = escapeHtml(label);
        const safeValue = escapeHtml(value);
        return `<div class="kv" style="margin-bottom: 8px;"><div class="k">${safeLabel}</div><div class="v">${safeValue}</div></div>`;
      })
      .join("");
  }

  /**
   * Render extracted fields only (when no comparison is possible)
   */
  function renderExtractedFieldsOnly(idFields) {
    if (!idFields) return "";

    const fieldLabels = {
      firstName: "First Name",
      lastName: "Last Name",
      middleName: "Middle Name",
      addressLine1: "Address Line 1",
      addressLine2: "Address Line 2",
      barangay: "Barangay",
      sex: "Sex/Gender",
      idNumber: "ID Number",
      birthDate: "Birth Date",
      expiryDate: "Expiry Date",
    };

    const entries = Object.entries(idFields)
      .filter(([k, v]) => v != null && String(v).trim() !== "")
      .map(([k, v]) => {
        const label =
          fieldLabels[k] ||
          k
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase());
        let value = String(v).trim();

        // Format dates
        if (
          (k === "birthDate" || k === "expiryDate") &&
          value.match(/^\d{4}-\d{2}-\d{2}$/)
        ) {
          const date = new Date(value);
          value = date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        }

        return { key: k, label, value };
      });

    if (entries.length === 0) return "";

    return entries
      .map(({ key, label, value }) => {
        const safeLabel = escapeHtml(label);
        const safeValue = escapeHtml(value);
        return `<div class="kv" style="margin-bottom: 8px;"><div class="k">${safeLabel}</div><div class="v">${safeValue}</div></div>`;
      })
      .join("");
  }

  function status(text, kind = "info") {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.color =
      kind === "error"
        ? "var(--error-600)"
        : kind === "success"
        ? "var(--success-600)"
        : "var(--gray-600)";
  }

  function escapeHtml(s) {
    return s.replace(
      /[&<>"]+/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );
  }

  // Re-run comparison when form fields change (if ID data is available)
  const formFields = [
    "firstName",
    "lastName",
    "middleName",
    "addressLine1",
    "addressLine2",
    "barangay",
    "gender",
  ];
  formFields.forEach((fieldId) => {
    const field = qs(`#${fieldId}`);
    if (field) {
      field.addEventListener("input", () => {
        if (extractedIdData) {
          compareWithFormData(extractedIdData);
        }
      });
      field.addEventListener("change", () => {
        if (extractedIdData) {
          compareWithFormData(extractedIdData);
        }
      });
    }
  });

  // Initialize
  setMode("upload");
  updateScanEnabled();
})();
