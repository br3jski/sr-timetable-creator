let stations = [];
let trainCategories = [];
let railwayLines = [];
let selectedLines = [];


document.addEventListener('DOMContentLoaded', function() {
    // Initialize Material Design Components
    mdc.autoInit();

    // Initialize select components
    const selects = document.querySelectorAll('.mdc-select');
    selects.forEach(select => new mdc.select.MDCSelect(select));

    // Initialize text fields
    const textFields = document.querySelectorAll('.mdc-text-field');
    textFields.forEach(textField => new mdc.textField.MDCTextField(textField));

    // Load initial data
    loadStations();
    loadTrainCategories();
    loadExistingSchedules();
});

document.getElementById('railwayLineSelect').addEventListener('change', function() {
    saveLastSelectedLine(this.value);
});
document.addEventListener('DOMContentLoaded', function() {
    loadStations();
    loadRailwayLines();
})

function loadRailwayLines() {
    fetch('/api/railway_lines')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        railwayLines = data;
        updateRailwayLineDropdown();
    })
    .catch(error => {
        console.error('Error loading railway lines:', error);
    });
}

function updateRailwayLineDropdown() {
    const lineSelect = document.getElementById('railwayLineSelect');
    const lastSelectedLine = getLastSelectedLine();

    lineSelect.innerHTML = '<option value="">Select a line</option>' +
        railwayLines.map(line =>
            `<option value="${line.id}" ${line.id === lastSelectedLine ? 'selected' : ''}>${line.name}</option>`
        ).join('');

    // Jeśli jest zapamiętana linia, przewiń do niej
    if (lastSelectedLine) {
        const selectedOption = lineSelect.querySelector(`option[value="${lastSelectedLine}"]`);
        if (selectedOption) {
            selectedOption.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

function addSelectedLine() {
    const lineSelect = document.getElementById('railwayLineSelect');
    const selectedOptions = Array.from(lineSelect.selectedOptions);

    selectedOptions.forEach(option => {
        if (!selectedLines.some(line => line.id === option.value)) {
            selectedLines.push({
                id: option.value,
                name: option.text,
                kilometer: ''
            });
        }
    });

    updateSelectedLinesDisplay();
}

function updateSelectedLinesDisplay() {
    const selectedLinesDiv = document.getElementById('selectedLines');
    selectedLinesDiv.innerHTML = selectedLines.map((line, index) => `
        <div>
            <span>${line.name}</span>
            <input type="number" step="0.001" placeholder="Km"
                   onchange="updateKilometer(${index}, this.value)">
            <button onclick="removeLine(${index})">Remove</button>
        </div>
    `).join('');
}

function updateKilometer(index, value) {
    selectedLines[index].kilometer = value;
}

function removeLine(index) {
    selectedLines.splice(index, 1);
    updateSelectedLinesDisplay();
}

function addStationLine() {
    const linesDiv = document.getElementById('stationLines');
    const newLine = document.createElement('div');
    newLine.className = 'station-line';
    newLine.innerHTML = `
        <select class="railway-line">
            <option value="">Select a line</option>
            ${railwayLines.map(line => `<option value="${line.id}">${line.name}</option>`).join('')}
        </select>
        <input type="number" class="kilometer" placeholder="Kilometer position" step="0.001">
    `;
    linesDiv.appendChild(newLine);
}

function updateStopLines(stopDiv, stationId) {
    const lineSelect = stopDiv.querySelector('.railway-line');
    lineSelect.innerHTML = '<option value="">Loading...</option>';

    fetch(`/api/station_lines/${stationId}`)
    .then(response => response.json())
    .then(lines => {
        lineSelect.innerHTML = '<option value="">Select a line</option>' +
            lines.map(line => `<option value="${line.id}" data-kilometer="${line.kilometer}">Linia ${line.id}, ${line.name} (${line.kilometer} km)</option>`).join('');
    });
}

function loadTrainCategories() {
    fetch('/api/train_categories')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        trainCategories = data;
        updateTrainCategoryDropdown();
    })
    .catch(error => {
        console.error('Error loading train categories:', error);
        // Możesz tutaj dodać kod do wyświetlenia komunikatu o błędzie dla użytkownika
    });
}
function updateTrainCategoryDropdown() {
    const categoryList = document.getElementById('trainCategory');
    if (!categoryList) {
        console.error('Train category list element not found');
        return;
    }

    categoryList.innerHTML = `
        <li class="mdc-list-item" data-value="">
            <span class="mdc-list-item__text">Select a category</span>
        </li>
        ${trainCategories.map(category => `
            <li class="mdc-list-item" data-value="${category}">
                <span class="mdc-list-item__text">${category}</span>
            </li>
        `).join('')}
    `;

    // Reinitialize the MDC select
    const selectElement = document.getElementById('trainCategorySelect');
    if (selectElement) {
        const select = new mdc.select.MDCSelect(selectElement);
    } else {
        console.error('Train category select element not found');
    }
}

function loadStations() {
    fetch('/api/stations')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        stations = data;
        // Nie musimy tutaj aktualizować dropdown'a,
        // ponieważ stacje są dodawane dynamicznie w funkcji addStop()
    })
    .catch(error => {
        console.error('Error loading stations:', error);
    });
}

function saveLastSelectedLine(lineId) {
    localStorage.setItem('lastSelectedLine', lineId);
}

function getLastSelectedLine() {
    return localStorage.getItem('lastSelectedLine');
}

function updateStationDropdown() {
    const stationSelect = document.querySelector('.station');
    if (stationSelect) {
        stationSelect.innerHTML = '<option value="">Select a station</option>' +
            stations.map(station =>
                `<option value="${station.id}">${station.name}</option>`
            ).join('');
    }
}

function updateLineDropdown(stopElement, stationId) {
    const lineSelect = stopElement.querySelector('.railway-line');
    const mdcSelect = mdc.select.MDCSelect.attachTo(stopElement.querySelector('.mdc-select:nth-child(2)'));

    if (lineSelect) {
        const station = stations.find(s => s.id === parseInt(stationId));
        if (station) {
            lineSelect.innerHTML = `
                <li class="mdc-list-item" data-value="">
                    <span class="mdc-list-item__text">Select a line</span>
                </li>
                ${station.lines.map(line => `
                    <li class="mdc-list-item" data-value="${line.id}" data-kilometer="${line.kilometer}">
                        <span class="mdc-list-item__text">Linia ${line.id}, ${line.name} (${line.kilometer} km)</span>
                    </li>
                `).join('')}
            `;
            mdcSelect.layoutOptions();
        } else {
            lineSelect.innerHTML = `
                <li class="mdc-list-item" data-value="">
                    <span class="mdc-list-item__text">Select a line</span>
                </li>
            `;
            mdcSelect.layoutOptions();
        }
    }
}

function submitStation() {
    const stationName = document.getElementById('stationName').value;
    const lineId = document.getElementById('railwayLineSelect').value;
    let kilometer = document.getElementById('kilometerPosition').value;
    saveLastSelectedLine(lineId);

    if (!stationName || !lineId || kilometer === '') {
        alert('Please enter station name, select a line, and enter kilometer position.');
        return;
    }

    // Zamień przecinek na kropkę, jeśli użytkownik wprowadził przecinek
    kilometer = kilometer.replace(',', '.');

    // Sprawdź, czy kilometraż jest poprawną liczbą
    const kmValue = parseFloat(kilometer);
    if (isNaN(kmValue) || kmValue < 0) {
        alert('Please enter a valid non-negative number for kilometer position (e.g. 4.245 or 0)');
        return;
    }

    const stationData = {
        name: stationName,
        lines: [{
            id: lineId,
            kilometer: kmValue.toFixed(3) // Zaokrąglij do 3 miejsc po przecinku
        }]
    };

    fetch('/api/stations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(stationData),
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw err; });
        }
        return response.json();
    })
    .then(data => {
        console.log('Success:', data);
        loadStations();
        clearStationForm();
    })
    .catch((error) => {
        console.error('Error:', error);
        alert(error.error || 'An error occurred while adding the station.');
    });
}

function clearStationForm() {
    document.getElementById('stationName').value = '';
    //document.getElementById('railwayLineSelect').value = '';
    document.getElementById('kilometerPosition').value = '';
}

function updateArrivalTime(travelTimeInput) {
    const stopDiv = travelTimeInput.closest('.stop');
    const arrivalInput = stopDiv.querySelector('.arrival');
    const previousStop = stopDiv.previousElementSibling;

    if (previousStop) {
        const previousDeparture = previousStop.querySelector('.departure').value;
        if (previousDeparture) {
            const travelTime = parseInt(travelTimeInput.value) || 0;
            arrivalInput.value = addMinutesToTime(previousDeparture, travelTime);
            updateDepartureTime(arrivalInput);
        }
    }
}

function addStop() {
    const stopsDiv = document.getElementById('stops');
    const newStop = document.createElement('div');
    newStop.className = 'stop mdc-card';
    newStop.style.padding = '16px';
    newStop.style.marginBottom = '16px';
    newStop.innerHTML = `
        <div class="mdc-select mdc-select--outlined" style="width: 100%; margin-bottom: 16px;">
            <div class="mdc-select__anchor">
                <span class="mdc-select__selected-text"></span>
                <span class="mdc-select__dropdown-icon">
                    <svg class="mdc-select__dropdown-icon-graphic" viewBox="7 10 10 5">
                        <polygon class="mdc-select__dropdown-icon-inactive" stroke="none" fill-rule="evenodd" points="7 10 12 15 17 10"></polygon>
                        <polygon class="mdc-select__dropdown-icon-active" stroke="none" fill-rule="evenodd" points="7 15 12 10 17 15"></polygon>
                    </svg>
                </span>
                <span class="mdc-notched-outline">
                    <span class="mdc-notched-outline__leading"></span>
                    <span class="mdc-notched-outline__notch">
                        <span class="mdc-floating-label">Select a station</span>
                    </span>
                    <span class="mdc-notched-outline__trailing"></span>
                </span>
            </div>
            <div class="mdc-select__menu mdc-menu mdc-menu-surface">
                <ul class="mdc-list station">
                    <li class="mdc-list-item" data-value="">
                        <span class="mdc-list-item__text">Select a station</span>
                    </li>
                    ${stations.map(station => `<li class="mdc-list-item" data-value="${station.id}">
                        <span class="mdc-list-item__text">${station.name}</span>
                    </li>`).join('')}
                </ul>
            </div>
        </div>

        <div class="mdc-select mdc-select--outlined" style="width: 100%; margin-bottom: 16px;">
            <div class="mdc-select__anchor">
                <span class="mdc-select__selected-text"></span>
                <span class="mdc-select__dropdown-icon">
                    <svg class="mdc-select__dropdown-icon-graphic" viewBox="7 10 10 5">
                        <polygon class="mdc-select__dropdown-icon-inactive" stroke="none" fill-rule="evenodd" points="7 10 12 15 17 10"></polygon>
                        <polygon class="mdc-select__dropdown-icon-active" stroke="none" fill-rule="evenodd" points="7 15 12 10 17 15"></polygon>
                    </svg>
                </span>
                <span class="mdc-notched-outline">
                    <span class="mdc-notched-outline__leading"></span>
                    <span class="mdc-notched-outline__notch">
                        <span class="mdc-floating-label">Select a line</span>
                    </span>
                    <span class="mdc-notched-outline__trailing"></span>
                </span>
            </div>
            <div class="mdc-select__menu mdc-menu mdc-menu-surface">
                <ul class="mdc-list railway-line">
                    <li class="mdc-list-item" data-value="">
                        <span class="mdc-list-item__text">Select a line</span>
                    </li>
                </ul>
            </div>
        </div>

        <div class="mdc-select mdc-select--outlined" style="width: 100%; margin-bottom: 16px;">
            <div class="mdc-select__anchor">
                <span class="mdc-select__selected-text"></span>
                <span class="mdc-select__dropdown-icon">
                    <svg class="mdc-select__dropdown-icon-graphic" viewBox="7 10 10 5">
                        <polygon class="mdc-select__dropdown-icon-inactive" stroke="none" fill-rule="evenodd" points="7 10 12 15 17 10"></polygon>
                        <polygon class="mdc-select__dropdown-icon-active" stroke="none" fill-rule="evenodd" points="7 15 12 10 17 15"></polygon>
                    </svg>
                </span>
                <span class="mdc-notched-outline">
                    <span class="mdc-notched-outline__leading"></span>
                    <span class="mdc-notched-outline__notch">
                        <span class="mdc-floating-label">Stop Type</span>
                    </span>
                    <span class="mdc-notched-outline__trailing"></span>
                </span>
            </div>
            <div class="mdc-select__menu mdc-menu mdc-menu-surface">
                <ul class="mdc-list stopType">
                    <li class="mdc-list-item" data-value="regular">
                        <span class="mdc-list-item__text">Regular</span>
                    </li>
                    <li class="mdc-list-item" data-value="via">
                        <span class="mdc-list-item__text">Via (przelot)</span>
                    </li>
                    <li class="mdc-list-item" data-value="ph">
                        <span class="mdc-list-item__text">PH (postój handlowy)</span>
                    </li>
                    <li class="mdc-list-item" data-value="pt">
                        <span class="mdc-list-item__text">PT (postój techniczny)</span>
                    </li>
                </ul>
            </div>
        </div>

        <div class="mdc-text-field mdc-text-field--outlined" style="width: 100%; margin-bottom: 16px;">
            <input type="time" class="mdc-text-field__input arrival">
            <div class="mdc-notched-outline">
                <div class="mdc-notched-outline__leading"></div>
                <div class="mdc-notched-outline__notch">
                    <label class="mdc-floating-label">Arrival Time</label>
                </div>
                <div class="mdc-notched-outline__trailing"></div>
            </div>
        </div>

        <div class="mdc-text-field mdc-text-field--outlined" style="width: 100%; margin-bottom: 16px;">
            <input type="time" class="mdc-text-field__input departure">
            <div class="mdc-notched-outline">
                <div class="mdc-notched-outline__leading"></div>
                <div class="mdc-notched-outline__notch">
                    <label class="mdc-floating-label">Departure Time</label>
                </div>
                <div class="mdc-notched-outline__trailing"></div>
            </div>
        </div>

        <button class="mdc-button mdc-button--outlined" style="margin-right: 8px;">
            <span class="mdc-button__ripple"></span>
            <span class="mdc-button__label">Remove Stop</span>
        </button>
    `;
    stopsDiv.appendChild(newStop);

    // Initialize new Material Design Components
    const newSelects = newStop.querySelectorAll('.mdc-select');
    newSelects.forEach(select => {
        const mdcSelect = new mdc.select.MDCSelect(select);
        if (select.querySelector('.station')) {
            mdcSelect.listen('MDCSelect:change', function() {
                updateLineDropdown(newStop, this.value);
            });
        }
    });

    const newTextFields = newStop.querySelectorAll('.mdc-text-field');
    newTextFields.forEach(textField => new mdc.textField.MDCTextField(textField));

    // Add event listener for remove button
    const removeButton = newStop.querySelector('.mdc-button');
    removeButton.addEventListener('click', function() {
        newStop.remove();
    });
}

function handleStopTypeChange(selectElement) {
    const stopDiv = selectElement.closest('.stop');
    const arrivalInput = stopDiv.querySelector('.arrival');
    const departureInput = stopDiv.querySelector('.departure');
    const stopDurationInput = stopDiv.querySelector('.stopDuration');
    const travelTimeInput = stopDiv.querySelector('.travelTime');
    const isFirstStop = !travelTimeInput;

    if (selectElement.value === 'via') {
        departureInput.readOnly = true;
        stopDurationInput.style.display = 'none';
        if (!isFirstStop) {
            arrivalInput.readOnly = false;
        }
    } else if (selectElement.value === 'ph' || selectElement.value === 'pt') {
        departureInput.readOnly = true;
        stopDurationInput.style.display = 'inline-block';
        if (!isFirstStop) {
            arrivalInput.readOnly = false;
        }
    } else {
        departureInput.readOnly = isFirstStop ? false : true;
        stopDurationInput.style.display = 'inline-block';
        if (!isFirstStop) {
            arrivalInput.readOnly = false;
        }
    }

    if (travelTimeInput) {
        updateArrivalTime(travelTimeInput);
    }
}

function updateDepartureTime(arrivalInput) {
    const stopDiv = arrivalInput.closest('.stop');
    const departureInput = stopDiv.querySelector('.departure');
    const stopDurationInput = stopDiv.querySelector('.stopDuration');
    const stopType = stopDiv.querySelector('.stopType').value;

    if (stopType === 'via') {
        departureInput.value = arrivalInput.value;
    } else {
        const arrivalTime = arrivalInput.value;
        const stopDuration = parseInt(stopDurationInput.value) || 0;
        departureInput.value = addMinutesToTime(arrivalTime, stopDuration);
    }
}

function addMinutesToTime(time, minutes) {
    const [hours, mins] = time.split(':').map(Number);
    const date = new Date(0, 0, 0, hours, mins + minutes);
    return date.toTimeString().slice(0, 5);
}

function submitSchedule() {
    const trainCategory = document.getElementById('trainCategory').value;
    const trainId = document.getElementById('trainId').value;
    const stops = Array.from(document.getElementsByClassName('stop')).map(stop => ({
        station: stop.querySelector('.station').value,
        stopType: stop.querySelector('.stopType').value,
        arrival: stop.querySelector('.arrival').value,
        departure: stop.querySelector('.departure').value
    }));

    fetch('/api/schedules', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({category: trainCategory, id: trainId, stops: stops}),
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
        loadSchedules();
        clearForm();
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

function replicateSchedule() {
    const sourceId = document.getElementById('sourceId').value;
    const newId = document.getElementById('newId').value;
    const timeShift = parseInt(document.getElementById('timeShift').value) || 0;

    fetch('/api/schedules/replicate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({sourceId: sourceId, newId: newId, timeShift: timeShift}),
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
        loadSchedules();
        clearReplicationForm();
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

function clearReplicationForm() {
    document.getElementById('sourceId').value = '';
    document.getElementById('newId').value = '';
    document.getElementById('timeShift').value = '';
}

function loadSchedules() {
    fetch('/api/schedules')
    .then(response => response.json())
    .then(data => {
        const scheduleList = document.getElementById('scheduleList');
        scheduleList.innerHTML = '';
        data.schedules.forEach(schedule => {
            const scheduleDiv = document.createElement('div');
            scheduleDiv.className = 'schedule';
            scheduleDiv.innerHTML = `
                <h3>${schedule.category} ${schedule.id}</h3>
                <ul>
                    ${schedule.stops.map((stop, index) => `
                        <li>
                            ${stop.station} (${stop.stopType}): ${stop.arrival} - ${stop.departure}
                            ${stop.stopDuration ? `(Postój: ${stop.stopDuration} min)` : ''}
                        </li>
                    `).join('')}
                </ul>
                <button onclick="editSchedule('${schedule.id}')">Edit</button>
                <button onclick="deleteSchedule('${schedule.id}')">Delete</button>
            `;
            scheduleList.appendChild(scheduleDiv);
        });
    });
}

function editSchedule(scheduleId) {
    fetch(`/api/schedules/${scheduleId}`)
    .then(response => response.json())
    .then(schedule => {
        document.getElementById('trainCategory').value = schedule.category;
        document.getElementById('trainId').value = schedule.id;

        const stopsDiv = document.getElementById('stops');
        stopsDiv.innerHTML = '';
        schedule.stops.forEach((stop, index) => {
            addStop();
            const stopDiv = stopsDiv.lastElementChild;
            stopDiv.querySelector('.station').value = stop.station;
            stopDiv.querySelector('.stopType').value = stop.stopType;
            stopDiv.querySelector('.arrival').value = stop.arrival;
            stopDiv.querySelector('.departure').value = stop.departure;
            if (stop.stopDuration) {
                stopDiv.querySelector('.stopDuration').value = stop.stopDuration;
            }
            if (index > 0) {
                stopDiv.querySelector('.travelTime').value = stop.travelTime;
            }
        });

        // Zmień tekst przycisku submit na "Update"
        const submitButton = document.querySelector('button[onclick="submitSchedule()"]');
        submitButton.textContent = 'Update Schedule';
        submitButton.onclick = function() { updateSchedule(scheduleId); };
    });
}

function updateSchedule(scheduleId) {
    const trainCategory = document.getElementById('trainCategory').value;
    const trainId = document.getElementById('trainId').value;
    const stops = Array.from(document.getElementsByClassName('stop')).map(stop => ({
        station: stop.querySelector('.station').value,
        stopType: stop.querySelector('.stopType').value,
        arrival: stop.querySelector('.arrival').value,
        departure: stop.querySelector('.departure').value
    }));

    fetch(`/api/schedules/${scheduleId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({category: trainCategory, id: trainId, stops: stops}),
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
        loadSchedules();
        clearForm();
        // Przywróć oryginalną funkcjonalność przycisku submit
        const submitButton = document.querySelector('button[onclick="updateSchedule(\'${scheduleId}\')"]');
        submitButton.textContent = 'Submit Schedule';
        submitButton.onclick = submitSchedule;
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

function deleteSchedule(trainId) {
    if (confirm(`Are you sure you want to delete the schedule for train ${trainId}?`)) {
        fetch(`/api/schedules/${trainId}`, {
            method: 'DELETE',
        })
        .then(response => response.json())
        .then(data => {
            console.log('Success:', data);
            loadSchedules(); // Odśwież listę rozkładów po usunięciu
        })
        .catch((error) => {
            console.error('Error:', error);
        });
    }
}

function clearForm() {
    document.getElementById('trainCategory').value = '';
    document.getElementById('trainId').value = '';
    document.getElementById('stops').innerHTML = '';
    addStop(); // Add one empty stop

    // Reset submit button
    const submitButton = document.querySelector('button[onclick="submitSchedule()"]');
    if (submitButton) {
        submitButton.textContent = 'Submit Schedule';
        submitButton.onclick = submitSchedule;
    }
}


loadSchedules();
loadStations();
loadTrainCategories();
loadRailwayLines();
addStationLine();