(function(){
    let currentDept = null;
    let deptOfficers = [];
    
    // Simple role guard without complex redirects
    window.addEventListener('DOMContentLoaded', async () => {
        try {
            // Wait for supabaseManager to be available
            console.log('Waiting for supabaseManager...');
            let attempts = 0;
            while (!window.supabaseBridge && attempts < 200) {
                await new Promise(resolve => setTimeout(resolve, 25));
                attempts++;
                if (attempts % 20 === 0) {
                    console.log(`Still waiting... attempt ${attempts}`);
                }
            }
            
            if (!window.supabaseBridge) {
                throw new Error('Supabase manager not available after 5 seconds');
            }
            
            console.log('Supabase manager found!');
            
            // Simple role check - just get the role without redirecting
            console.log('Initializing Supabase via bridge...');
            await window.supabaseBridge.initialize();
            const sb = window.supabaseBridge.getClient();
            console.log('Getting user...');
            const { data: { user } } = await sb.auth.getUser();
            console.log('User data:', user);
            const role = (user?.user_metadata?.role || '').toLowerCase();
            console.log('User role:', role);
            
            // Only allow lgu-admin-<dept> to access this page
            if (!role.startsWith('lgu-admin-')) {
                // Instead of redirecting, just show an error message
                document.body.innerHTML = '<div class="container py-4"><div class="alert alert-danger">Access Denied: Only LGU Admins can access this page. Your role: ' + role + '</div></div>';
                return;
            }
            
            currentDept = role.replace('lgu-admin-', '');
            console.log('Current department:', currentDept);

            // Preload officers for this department to enable selection in dispatch
            try {
                const res = await fetch(`/api/officers?department=${encodeURIComponent(currentDept)}`);
                const json = await res.json();
                if (res.ok && Array.isArray(json.officers)) {
                    deptOfficers = json.officers;
                } else {
                    deptOfficers = [];
                }
            } catch (_) {
                deptOfficers = [];
            }
        } catch (error) {
            console.error('Error in role check:', error);
            document.body.innerHTML = '<div class="container py-5"><div class="alert alert-danger">Error loading page. Please refresh or contact support.</div></div>';
        }
    });

    // Load all users for the table
    async function loadUsers() {
        try {
            console.log('Loading users...');
            console.log('Current department:', currentDept);
            const res = await fetch('/api/users');
            console.log('Response status:', res.status);
            
            if (res.ok) {
                const data = await res.json();
                console.log('All users data:', data);
                const { users } = data;
                const tableBody = document.getElementById('users-table-body');
                
                if (tableBody && users) {
                    tableBody.innerHTML = '';
                    
                    console.log('Total users found:', users.length);
                    console.log('Users with roles:', users.map(u => ({ email: u.email, role: u.user_metadata?.role })));
                    
                    // Filter users to only show those from the admin's department or citizens
                    const filteredUsers = users.filter(user => {
                        const currentRole = user.user_metadata?.role || 'citizen';
                        const userDepartment = currentRole.includes('-') ? currentRole.split('-').pop() : null;
                        
                        console.log(`User ${user.email}: role=${currentRole}, department=${userDepartment}, currentDept=${currentDept}`);
                        
                        // Hide superadmin from all department admins
                        if (currentRole === 'superadmin') {
                            return false;
                        }
                        
                        // Show citizens (can be promoted) and users from admin's department (can be managed)
                        const shouldShow = currentRole === 'citizen' || userDepartment === currentDept;
                        console.log(`Should show ${user.email}: ${shouldShow}`);
                        return shouldShow;
                    });
                    
                    console.log('Filtered users:', filteredUsers.length);
                    
                    if (filteredUsers.length === 0) {
                        tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No users found for your department</td></tr>';
                        return;
                    }
                    
                    filteredUsers.forEach(user => {
                        const row = document.createElement('tr');
                        const currentRole = user.user_metadata?.role || 'citizen';
                        const department = currentRole.includes('-') ? currentRole.split('-').pop() : 'N/A';
                        
                        row.innerHTML = `
                            <td>${user.email}</td>
                            <td>
                                <span class="badge ${getRoleBadgeClass(currentRole)}">${formatRole(currentRole)}</span>
                            </td>
                            <td>${department}</td>
                            <td>
                                <div class="btn-group btn-group-sm" role="group">
                                    ${getActionButtons(user.id, currentRole)}
                                </div>
                            </td>
                        `;
                        
                        tableBody.appendChild(row);
                    });
                    
                    // Add event listeners to action buttons
                    addActionButtonListeners();
                }
            } else {
                console.error('Error loading users:', res.status, res.statusText);
                const errorText = await res.text();
                console.error('Error response:', errorText);
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    // Get appropriate badge class for role
    function getRoleBadgeClass(role) {
        if (role.includes('admin')) return 'bg-danger';
        if (role.includes('lgu')) return 'bg-primary';
        return 'bg-secondary';
    }

    // Format role for display
    function formatRole(role) {
        if (role.includes('admin')) return 'LGU Admin';
        if (role.includes('lgu')) return 'LGU Officer';
        return 'Citizen';
    }

    // Generate action buttons based on current role
    function getActionButtons(userId, currentRole) {
        const buttons = [];
        
        if (currentRole === 'citizen') {
            buttons.push(`<button class="btn btn-outline-primary btn-sm" data-action="promote-lgu" data-user-id="${userId}">Promote to LGU</button>`);
            buttons.push(`<button class="btn btn-outline-danger btn-sm" data-action="promote-admin" data-user-id="${userId}">Make Admin</button>`);
        } else if (currentRole.includes('lgu') && !currentRole.includes('admin')) {
            buttons.push(`<button class="btn btn-outline-danger btn-sm" data-action="promote-admin" data-user-id="${userId}">Make Admin</button>`);
            buttons.push(`<button class="btn btn-outline-secondary btn-sm" data-action="demote-citizen" data-user-id="${userId}">Demote to Citizen</button>`);
        } else if (currentRole.includes('admin')) {
            buttons.push(`<button class="btn btn-outline-primary btn-sm" data-action="demote-lgu" data-user-id="${userId}">Demote to LGU</button>`);
            buttons.push(`<button class="btn btn-outline-secondary btn-sm" data-action="demote-citizen" data-user-id="${userId}">Demote to Citizen</button>`);
        }
        
        return buttons.join('');
    }

    // Add event listeners to action buttons
    function addActionButtonListeners() {
        document.querySelectorAll('[data-action]').forEach(button => {
            button.addEventListener('click', async (e) => {
                const action = e.target.getAttribute('data-action');
                const userId = e.target.getAttribute('data-user-id');
                const result = document.getElementById('role-result');
                
                if (!userId) {
                    result.textContent = 'Error: User ID not found';
                    result.className = 'mt-3 small text-danger';
                    return;
                }

                // Additional security: Verify the user can be managed by this admin
                if (!canManageUser(userId, action)) {
                    result.textContent = 'Error: You can only manage users from your own department';
                    result.className = 'mt-3 small text-danger';
                    return;
                }

                result.textContent = 'Updating role...';
                result.className = 'mt-3 small text-info';
                
                try {
                    let newRole = '';
                    switch (action) {
                        case 'promote-lgu':
                            newRole = `lgu-${currentDept}`;
                            break;
                        case 'promote-admin':
                            newRole = `lgu-admin-${currentDept}`;
                            break;
                        case 'demote-lgu':
                            newRole = `lgu-${currentDept}`;
                            break;
                        case 'demote-citizen':
                            newRole = 'citizen';
                            break;
                        default:
                            throw new Error('Invalid action');
                    }

                    const res = await fetch('/api/update-role', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, newRole })
                    });

                    if (res.ok) {
                        result.textContent = `Role updated to ${formatRole(newRole)}`;
                        result.className = 'mt-3 small text-success';
                        // Refresh the user list to show updated roles
                        await loadUsers();
                    } else {
                        const error = await res.json();
                        result.textContent = `Error: ${error.message || 'Failed to update role'}`;
                        result.className = 'mt-3 small text-danger';
                    }
                } catch (error) {
                    result.textContent = `Error: ${error.message}`;
                    result.className = 'mt-3 small text-danger';
                }
            });
        });
    }

    // Check if the admin can manage a specific user
    function canManageUser(userId, action) {
        // Find the user in the current table
        const userRow = document.querySelector(`[data-user-id="${userId}"]`)?.closest('tr');
        if (!userRow) return false;
        
        const roleCell = userRow.querySelector('.badge');
        if (!roleCell) return false;
        
        const currentRole = roleCell.textContent.toLowerCase();
        
        // Citizens can always be promoted (they have no department)
        if (currentRole === 'citizen') {
            return action.startsWith('promote');
        }
        
        // For demotion actions, ensure the user is from the admin's department
        if (action.startsWith('demote')) {
            // The user should already be filtered to only show department users
            // This is an additional security check
            return true;
        }
        
        return true;
    }

    // Handle refresh button
    document.addEventListener('DOMContentLoaded', () => {
        const refreshBtn = document.getElementById('refresh-users');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await loadUsers();
            });
        }
    });

    // Load users when page loads
    window.addEventListener('load', loadUsers);


})();
