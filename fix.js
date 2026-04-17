const fs = require('fs');
const path = 'views/pages/citizen/fileComplaint.html';
let content = fs.readFileSync(path, 'utf8');

const startRegex = /<div class="section-header">\s*<div class="section-icon">.+<\/div>\s*<h3>Location<\/h3>\s*<\/div>[\s\S]*?<!-- Duplicate Warning Container gets appended here by JS -->\s*<\/div>\s*<\/div>\s*<\/div>/;

const newHtml = \              <div class="section-header" style="margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                <div class="section-icon" style="color: #60a5fa;">📍</div>
                <h3 style="font-size: 1.25rem;">Location Details</h3>
              </div>

              <div class="location-wrapper">
                <!-- Search Bar -->
                <div style="position: relative; margin-bottom: 16px;">
                  <span style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #9ca3af; font-size: 1.1rem; pointer-events: none;">🔍</span>
                  <input type="text" id="map-search-input" placeholder="Search street, barangay, landmark..." 
                    style="width: 100%; padding: 14px 16px 14px 44px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(31, 41, 55, 0.7); color: white; outline: none; transition: border-color 0.2s;" />
                </div>

                <div class="map-wrapper" style="position: relative; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 16px rgba(0,0,0,0.3); margin-bottom: 20px;">
                  <div id="complaint-map" class="premium-map" style="height: 400px; width:100%; position: relative;"></div>
                  <input type="hidden" id="latitude" name="latitude" />
                  <input type="hidden" id="longitude" name="longitude" />
                  
                  <!-- Floating Top Right Controls -->
                  <div style="position: absolute; right: 12px; top: 12px; display: flex; flex-direction: column; gap: 10px; z-index: 1000;">
                    <button type="button" id="btn-fullscreen-map" title="Toggle Fullscreen" 
                      style="background: rgba(17, 24, 39, 0.8); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; width: 42px; height: 42px; cursor: pointer; color: white; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); transition: background 0.2s;">
                      🔲
                    </button>
                    <button type="button" id="btn-toggle-boundaries" title="Toggle Boundaries"
                      style="background: rgba(17, 24, 39, 0.8); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; width: 42px; height: 42px; cursor: pointer; color: white; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); transition: background 0.2s;">
                      🗺️
                    </button>
                  </div>
                  
                  <!-- Floating Bottom Right Control -->
                  <div style="position: absolute; right: 12px; bottom: 24px; z-index: 1000;">
                    <button type="button" id="btn-auto-locate" class="auto-locate-btn" title="Use Current Location"
                      style="background: #2563eb; color: white; border: none; border-radius: 50%; width: 52px; height: 52px; cursor: pointer; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; transition: transform 0.2s ease;">
                      📍
                    </button>
                  </div>
                </div>

                <div class="form-group location-input-group required-field" style="background: rgba(17, 24, 39, 0.5); padding: 16px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <label for="location" style="margin: 0; color: #9ca3af; font-size: 0.85rem; font-weight: 600; text-transform: uppercase;">Selected Address <span style="color: #ef4444;">*</span></label>
                    <button type="button" id="btn-clear-location" style="background: rgba(239, 68, 68, 0.1); border: none; color: #ef4444; border-radius: 6px; padding: 4px 12px; font-size: 0.8rem; cursor: pointer; font-weight: 600; transition: background 0.2s;">
                      Clear
                    </button>
                  </div>
                  
                  <div style="display: flex; gap: 12px; align-items: center;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
                      📌
                    </div>
                    <input type="text" id="location" name="location" class="premium-input"
                      placeholder="Tap map or search to place pin" readonly required style="background: transparent; border: none; color: white; padding: 0; margin: 0; height: auto; outline: none; font-size: 1rem; width: 100%; cursor: default; cursor: pointer;" />
                  </div>
                  <small class="form-hint" style="color: #6b7280; font-size: 0.8rem; margin-top: 12px; display: block; padding-left: 52px; margin-bottom:0;">Drag the map pin to adjust your exact position.</small>
                </div>
                <!-- Duplicate Warning Container gets appended here by JS -->
              </div>
            </div>
          </div>\;

if (startRegex.test(content)) {
  content = content.replace(startRegex, newHtml);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Successfully replaced HTML structure for location step.');
} else {
  console.log('Regex did not match.');
}
