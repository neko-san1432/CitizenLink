const fs = require('fs');
const filepath = 'views/pages/hr/dashboard.html';

let content = fs.readFileSync(filepath, 'utf-8');

const targetTop = `  <div class="app-container">
    <div class="header-container"></div>
    <div id="sidebar" class="collapsible"></div>

    <div id="app" class="collapsible hr-dashboard">
      <!-- Welcome Section -->`;

const replTop = `  <div class="app-container">
    <div id="sidebar" class="collapsible"></div>

    <div id="app" class="collapsible hr-dashboard" style="display: flex; flex-direction: column;">
      <div class="header-container"></div>
      
      <div class="dashboard-main-wrapper" style="display: flex; flex-direction: column; flex: 1;">
        <!-- Welcome Section -->`;

const targetBot = `        </div>
      </div>
    </div>
  </div>

  <div id="toast-container" class="toast-container"></div>`;

const replBot = `        </div>
      </div>
      </div> <!-- End dashboard-main-wrapper -->
    </div>
  </div>

  <div id="toast-container" class="toast-container"></div>`;

if (content.includes(targetTop) && content.includes(targetBot)) {
    content = content.replace(targetTop, replTop).replace(targetBot, replBot);
    fs.writeFileSync(filepath, content, 'utf-8');
    console.log("HR PATCH SUCCESS");
} else {
    console.log("HR PATCH FAILED TO FIND TARGETS");
}
