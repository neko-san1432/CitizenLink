const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'views/pages/super-admin/dashboard.html');
let content = fs.readFileSync(filePath, 'utf8');

// Insert the skeleton loader after the Grid start
const gridStartMarker = '      <!-- Main Content Grid -->\n      <div class="dashboard-content gap-6 p-6">';
const skeletonHTML = `
      <div class="dashboard-content gap-6 p-6 relative">
        <!-- Global Skeleton Loader -->
        <div id="dashboard-loading" class="dashboard-loading" style="display: flex; flex-direction: column; gap: 1.5rem; width: 100%;">
          <!-- Stats Row Skeleton -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="skeleton" style="height: 80px; border-radius: 12px;"></div>
            <div class="skeleton" style="height: 80px; border-radius: 12px;"></div>
            <div class="skeleton" style="height: 80px; border-radius: 12px;"></div>
            <div class="skeleton" style="height: 80px; border-radius: 12px;"></div>
          </div>
          <!-- Charts Row Skeleton -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div class="skeleton" style="height: 300px; border-radius: 12px; grid-column: span 3;"></div>
            <div class="skeleton" style="height: 300px; border-radius: 12px;"></div>
          </div>
          <!-- Action Lists Row Skeleton -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="glass-panel" style="padding: 1rem;">
              <div class="skeleton" style="height: 24px; width: 150px; border-radius: 4px;"></div>
              <div class="space-y-3 mt-4">
                <div class="skeleton" style="height: 60px; border-radius: 8px;"></div>
                <div class="skeleton" style="height: 60px; border-radius: 8px;"></div>
                <div class="skeleton" style="height: 60px; border-radius: 8px;"></div>
              </div>
            </div>
            <div class="glass-panel" style="padding: 1rem;">
              <div class="skeleton" style="height: 24px; width: 150px; border-radius: 4px;"></div>
              <div class="grid grid-cols-2 gap-4 mt-4">
                <div class="skeleton" style="height: 100px; border-radius: 12px;"></div>
                <div class="skeleton" style="height: 100px; border-radius: 12px;"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Dashboard Real Content -->
        <div id="dashboard-main-content" style="display: none; opacity: 0; transition: opacity 0.3s ease;">`;

content = content.replace(gridStartMarker, '      <!-- Main Content Grid -->\n' + skeletonHTML);

// Close the wrapper
const endMarker = `                <h4 class="font-medium text-gray-900">System Settings</h4>
                <p class="text-sm text-gray-500 mt-1">Configure platform</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
const replacedEndMarker = `                <h4 class="font-medium text-gray-900">System Settings</h4>
                <p class="text-sm text-gray-500 mt-1">Configure platform</p>
              </button>
            </div>
          </div>
        </div>
        </div> <!-- End dashboard-main-content -->
      </div>
    </div>
  </div>`;

content = content.replace(endMarker, replacedEndMarker);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Super Admin dashboard patched successfully.');
