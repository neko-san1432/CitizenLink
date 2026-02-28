import os
import re

file_path = os.path.join(os.path.dirname(__file__), 'views/pages/super-admin/dashboard.html')

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

skeleton = """      <div class="dashboard-content gap-6 p-6 relative">
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
        <div id="dashboard-main-content" style="display: none; opacity: 0; transition: opacity 0.3s ease;">"""


# Replace top opening
content = re.sub(
    r'<div class="dashboard-content gap-6 p-6">',
    skeleton,
    content,
    count=1
)

# Replace bottom closing
end_pattern = r'(\s*<h4 class="font-medium text-gray-900">System Settings</h4>\s*<p class="text-sm text-gray-500 mt-1">Configure platform</p>\s*</button>\s*</div>\s*</div>\s*</div>)(\s*)</div>'

end_replacement = r'\1\2</div> <!-- End dashboard-main-content -->\2</div>'

content = re.sub(
    end_pattern,
    end_replacement,
    content,
    count=1
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Super Admin HTML successfully patched.")
