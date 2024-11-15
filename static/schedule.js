document.addEventListener('DOMContentLoaded', function() {
    loadStations();
    document.getElementById('stationSelect').addEventListener('change', loadStationSchedule);
});

function loadStations() {
    fetch('/api/stations')
    .then(response => response.json())
    .then(data => {
        const stationSelect = document.getElementById('stationSelect');
        data.stations.forEach(station => {
            const option = document.createElement('option');
            option.value = station.name;
            option.textContent = station.name;
            stationSelect.appendChild(option);
        });
    });
}

function loadStationSchedule() {
    const station = document.getElementById('stationSelect').value;
    if (!station) return;

    fetch(`/api/station_schedule/${encodeURIComponent(station)}`)
    .then(response => response.json())
    .then(data => {
        const tbody = document.querySelector('#scheduleTable tbody');
        tbody.innerHTML = '';
        data.schedule.forEach(train => {
            const row = tbody.insertRow();
            if (train.conflict) {
                row.classList.add('conflict');
            }
            row.insertCell().textContent = `${train.category} ${train.id}`;
            row.insertCell().textContent = train.route;
            row.insertCell().textContent = train.arrival;
            row.insertCell().textContent = train.departure;
            row.insertCell().textContent = train.stopType;
        });
    });
}