
document.addEventListener('DOMContentLoaded', () => {
    loadReviewQueue();
});

async function loadReviewQueue() {
    const tableBody = document.getElementById('complaint-list');
    const loading = document.getElementById('loading');

    try {
        const response = await fetch('/api/coordinator/review-queue?page=1&limit=10');
        const data = await response.json();

        if (loading) loading.style.display = 'none';

        if (data.success && data.data && data.data.length > 0) {
            tableBody.innerHTML = data.data.map(complaint => `
                <tr class="cursor-pointer hover:bg-gray-50" onclick="window.location.href='/review/${complaint.id}'">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-${getPriorityColor(complaint.priority)}-100 text-${getPriorityColor(complaint.priority)}-800">
                            ${complaint.priority}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${complaint.category || 'General'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${complaint.location_text || 'N/A'}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                        <div class="truncate w-64">${complaint.description}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${new Date(complaint.submitted_at).toLocaleDateString()}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <a href="/review/${complaint.id}" class="text-indigo-600 hover:text-indigo-900">Review</a>
                    </td>
                </tr>
            `).join('');
        } else {
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No complaints pending review</td></tr>';
        }
    } catch (error) {
        console.error('Failed to load review queue:', error);
        if (loading) loading.textContent = 'Error loading data';
    }
}

function getPriorityColor(priority) {
    switch (priority?.toLowerCase()) {
        case 'urgent': return 'red';
        case 'high': return 'orange';
        case 'medium': return 'blue';
        default: return 'gray';
    }
}
