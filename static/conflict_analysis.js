function analyzeConflicts() {
    fetch('/api/analyze_conflicts')
    .then(response => response.json())
    .then(data => {
        const conflictResults = document.getElementById('conflictResults');
        conflictResults.innerHTML = '';

        if (data.conflicts.length === 0) {
            conflictResults.innerHTML = '<p>No conflicts found.</p>';
        } else {
            const table = document.createElement('table');
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Train 1</th>
                        <th>Train 2</th>
                        <th>Section</th>
                        <th>Train 1 Time</th>
                        <th>Train 2 Time</th>
                        <th>Conflict Type</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.conflicts.map(conflict => `
                        <tr class="${conflict.conflict_type.toLowerCase().replace(' ', '-')}">
                            <td>${conflict.train1}</td>
                            <td>${conflict.train2}</td>
                            <td>${conflict.section}</td>
                            <td>${conflict.train1_time}</td>
                            <td>${conflict.train2_time}</td>
                            <td>${conflict.conflict_type}</td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
            conflictResults.appendChild(table);
        }
    });
}