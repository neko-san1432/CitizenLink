import { storageAvailable } from "./storage.js";

export default function getCurrentUser() {
  // Determine which storage to use
  const useStorage = storageAvailable("localStorage") ?
    localStorage :
    storageAvailable("sessionStorage") ?
      sessionStorage :
      null;
  if (!useStorage) {
    console.error("No storage mechanism available");
    return null;
  }
  try {
    console.log("Storage type:", useStorage);
    const userData = useStorage.getItem("user");
    console.log("User data from storage:", userData);
    if (!userData) return null;
    const user = JSON.parse(userData);
    console.log("Parsed user object:", user);
    if (!user || typeof user !== "object") return null;
    // Check session expiration (1 hour timeout)
    const lastActive = useStorage.getItem("lastActive");
    if (lastActive && Date.now() - parseInt(lastActive) > 3600000) {
      console.warn("Session expired due to inactivity");
      useStorage.removeItem("user");
      return null;
    }
    // Update last active timestamp
    useStorage.setItem("lastActive", Date.now().toString());
    return user;
  } catch (error) {
    console.error("Error parsing user data:", error);
    return null;
  }
}
