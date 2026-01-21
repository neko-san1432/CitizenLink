const fs = require("fs");

const filePath =
  "c:\\Users\\User\\Documents\\Projects\\acads\\CitizenLink\\public\\css\\pages\\index.css";

try {
  let content;
  // Try reading as utf16le
  try {
    content = fs.readFileSync(filePath, "utf16le");
    if (!content.includes("bg-digos.jpg")) {
      // Fallback to utf8 if not found (maybe it wasn't utf16le)
      content = fs.readFileSync(filePath, "utf8");
    }
  } catch (e) {
    content = fs.readFileSync(filePath, "utf8");
  }

  if (content.includes("bg-digos.jpg")) {
    console.log("Found bg-digos.jpg reference.");
    // Replace variations of paths
    // Original might be URL('../images/bg-digos.jpg') or similar
    const regex = /url\(['"]?.*?bg-digos\.jpg['"]?\)/g;

    const newContent = content.replace(
      regex,
      'url("/assets/images/bg-digos.jpg")'
    );

    fs.writeFileSync(filePath, newContent, "utf8"); // Save as utf8
    console.log("Fixed path and encoding.");
  } else {
    console.log("Could not find reference to bg-digos.jpg");
    // Still save as utf8 to fix encoding if it was utf16le
    fs.writeFileSync(filePath, content, "utf8");
    console.log("Converted to utf8.");
  }
} catch (err) {
  console.error(err);
}
