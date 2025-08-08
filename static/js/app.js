document.addEventListener('DOMContentLoaded', function() {
    // --- STATE & UI SELECTORS ---
    let weeklyChart, currentFlashcardState = {}, tempShotData = {};
    let gymPlannerState = {
        // We'll store the current week's start date
        currentWeekStartDate: getStartOfWeek(new Date())
    };

    const pages = document.querySelectorAll('.page');
    const navLinks = document.querySelectorAll('.sidebar-icon');
    const darkModeToggle = document.getElementById('darkModeToggle');

    // --- API HELPER ---
    async function apiRequest(url, method = 'GET', body = null) {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) options.body = JSON.stringify(body);
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
                throw new Error(errorData.error || `An unknown error occurred.`);
            }
            // Handle responses that might not have a JSON body (e.g., 201 Created with no content)
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                return response.json();
            }
            return {}; // Return empty object for non-json responses
        } catch (error) {
            console.error(`API request failed: ${method} ${url}`, error);
            alert(`Error: ${error.message}`);
            throw error;
        }
    }

    // --- CORE APP LOGIC ---
    function setupNavigation() {
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.dataset.target;
                pages.forEach(page => page.classList.add('hidden'));
                document.getElementById(targetId)?.classList.remove('hidden');
                navLinks.forEach(nav => nav.classList.remove('active'));
                link.classList.add('active');
                loadPageData(targetId);
            });
        });
        setupTabNavigation('.gym-tab', '.gym-pane', 'gym');
        setupTabNavigation('.bball-tab', '.bball-pane', 'basketball');
    }
    
    function setupTabNavigation(tabSelector, paneSelector, parentPageId) {
        const tabs = document.querySelectorAll(tabSelector);
        tabs.forEach(tab => {
            tab.addEventListener('click', e => {
                e.preventDefault();
                const targetId = tab.dataset.tabTarget;
                document.querySelectorAll(paneSelector).forEach(pane => pane.classList.add('hidden'));
                document.getElementById(targetId)?.classList.remove('hidden');
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                loadTabData(parentPageId, targetId);
            });
        });
    }

    function loadPageData(pageId) {
        switch(pageId) {
            case 'dashboard': renderDashboardMetrics(); break;
            case 'schedule': renderSchedule(); break;
            case 'gym': loadTabData('gym', document.querySelector('.gym-tab.active').dataset.tabTarget); break;
            case 'basketball': loadTabData('basketball', document.querySelector('.bball-tab.active').dataset.tabTarget); break;
            // Add other cases as needed
        }
    }

    function loadTabData(parentPageId, tabId) {
        if (parentPageId === 'gym') {
            switch(tabId) {
                case 'gym-today': renderTodaysWorkout(); break;
                case 'gym-planner': renderGymPlanner(); break;
                case 'gym-exercises': renderExerciseLibrary(); break;
                case 'gym-prs': renderPrLog(); break;
            }
        } else if (parentPageId === 'basketball') {
             switch(tabId) {
                case 'bball-stats': renderPlayerStats(); break;
                case 'bball-shot-chart': renderShotChart(); break;
                case 'bball-report': renderGameReport(); break; // Initial render
            }
        }
    }

    // --- EVENT DELEGATION ---
    document.body.addEventListener('click', handleGlobalClick);

    function handleGlobalClick(e) {
        const targetButton = e.target.closest('button, a, .close-modal, .sidebar-icon');
        if (!targetButton) return;

        // Modal close
        if (targetButton.matches('.close-modal, .modal')) {
            targetButton.closest('.modal').style.display = 'none';
            return;
        }

        const id = targetButton.id;
        const classList = targetButton.classList;

        // Static button IDs
        const actions = {
            'addPlayerBtn': addPlayer,
            'generateReportBtn': generateAndDisplayReport,
            'addExerciseBtn': () => openExerciseModal(),
            'saveExerciseBtn': saveExercise,
            'addGymPlanBtn': () => openGymPlanModal(targetButton.dataset.date),
            'saveGymPlanBtn': saveGymPlan,
            'prevWeekBtn': () => changeWeek(-7),
            'nextWeekBtn': () => changeWeek(7),
        };

        if (actions[id]) {
            actions[id]();
        } else if (classList.contains('complete-workout-btn')) {
            completeWorkout(targetButton.dataset.planId);
        } else if (classList.contains('edit-exercise-btn')) {
            openExerciseModal(targetButton.dataset.exerciseId);
        }
    }

    // --- DASHBOARD FUNCTIONS (Updated) ---
    async function renderDashboardMetrics() {
        const data = await apiRequest('/api/dashboard_metrics');
        document.getElementById('pomodoroDaily').textContent = formatTime(data.pomodoro.daily, true);
        document.getElementById('pomodoroWeekly').textContent = formatTime(data.pomodoro.weekly, true);
        document.getElementById('pomodoroMonthly').textContent = formatTime(data.pomodoro.monthly, true);
        
        const examContainer = document.getElementById('examCountdownContainer');
        examContainer.innerHTML = data.exams.length === 0 ? '<p class="text-gray-400">No upcoming exams.</p>' : data.exams.map(exam => `<div class="mb-2"><p><strong>${exam.name}</strong> is in <span class="text-blue-400 font-bold">${Math.max(0, Math.ceil((new Date(exam.date) - new Date()) / (1000 * 60 * 60 * 24)))} days</span></p></div>`).join('');
        
        const weakTopicsList = document.getElementById('weakTopicsList');
        weakTopicsList.innerHTML = !data.weak_topics || data.weak_topics.length === 0 ? '<li>No mistakes logged.</li>' : data.weak_topics.map(m => `<li>${m.topic} (${m.subject_name})</li>`).join('');

        // Render gym notification
        const notificationArea = document.getElementById('dashboard-notifications');
        if (data.gym_notification) {
            notificationArea.innerHTML = `<div class="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg relative" role="alert">
                <strong class="font-bold"><i class="fas fa-bell mr-2"></i>Reminder:</strong>
                <span class="block sm:inline">${data.gym_notification}</span>
            </div>`;
        } else {
            notificationArea.innerHTML = '';
        }

        updateCairoTime();
        if (!window.cairoTimeInterval) {
            window.cairoTimeInterval = setInterval(updateCairoTime, 1000);
        }
    }

    function updateCairoTime() {
        const timeEl = document.getElementById('cairo-time');
        const dateEl = document.getElementById('cairo-date');
        if (!timeEl || !dateEl) return;

        const now = new Date();
        const cairoTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
        
        const hours = cairoTime.getHours().toString().padStart(2, '0');
        const minutes = cairoTime.getMinutes().toString().padStart(2, '0');
        const seconds = cairoTime.getSeconds().toString().padStart(2, '0');
        
        timeEl.textContent = `${hours}:${minutes}:${seconds}`;
        dateEl.textContent = cairoTime.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    // --- SCHEDULE FUNCTIONS (Updated) ---
    async function renderSchedule() {
        const events = await apiRequest('/api/schedule');
        const container = document.getElementById('timeline-container');
        if (!container) return;
        
        // Clear and rebuild timeline hours
        container.innerHTML = '';
        for (let i = 0; i < 24; i++) {
            container.innerHTML += `<div class="timeline-hour"><span class="timeline-hour-label">${i.toString().padStart(2, '0')}:00</span></div>`;
        }
        
        // Add event elements
        events.forEach(e => {
            const startMinutes = timeToMinutes(e.start_time);
            const endMinutes = timeToMinutes(e.end_time);
            const duration = Math.max(15, endMinutes - startMinutes); // Min height of 15px
            
            const eventEl = document.createElement('div');
            eventEl.className = 'timeline-event';
            eventEl.style.top = `${startMinutes}px`;
            eventEl.style.height = `${duration}px`;
            
            const colorRgb = getColor(e.color);
            eventEl.style.backgroundColor = `rgba(${colorRgb}, 0.5)`;
            eventEl.style.borderColor = `rgb(${colorRgb})`;
            eventEl.innerHTML = `<p class="font-bold text-sm">${e.title}</p><p class="text-xs">${e.start_time} - ${e.end_time}</p>`;
            
            container.appendChild(eventEl);
        });
    }

    // --- GYM FUNCTIONS (All New or Heavily Modified) ---

    async function renderTodaysWorkout() {
        const container = document.getElementById('gym-today');
        container.innerHTML = '<p class="text-gray-400">Loading today\'s workout...</p>';
        
        const plan = await apiRequest('/api/gym/today');

        if (!plan) {
            container.innerHTML = '<div class="text-center"><i class="fas fa-couch fa-3x text-gray-500 mb-4"></i><h3 class="text-xl font-semibold">Rest Day!</h3><p class="text-gray-400">No workout planned for today. Enjoy your rest!</p></div>';
            return;
        }

        let exercisesHtml = plan.exercises.map(ex => `
            <div class="bg-gray-700 p-4 rounded-lg flex justify-between items-center">
                <div>
                    <p class="font-bold text-lg">${ex.exercise_name}</p>
                    <p class="text-sm text-blue-400">${ex.exercise_group}</p>
                </div>
                <div class="text-right">
                    <p><span class="font-semibold">${ex.sets}</span> sets</p>
                    <p><span class="font-semibold">${ex.reps}</span> reps</p>
                    ${ex.weight ? `<p>@ <span class="font-semibold">${ex.weight}</span></p>` : ''}
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="bg-gray-800 p-6 rounded-lg">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h2 class="text-2xl font-bold">${plan.name}</h2>
                        <p class="text-gray-400">${plan.start_time ? `Scheduled for ${plan.start_time.substring(0,5)}` : 'No time set'}</p>
                    </div>
                    ${!plan.completed ? `<button class="complete-workout-btn bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg" data-plan-id="${plan.id}"><i class="fas fa-check mr-2"></i>Mark as Completed</button>` : '<span class="text-green-400 font-bold flex items-center"><i class="fas fa-check-circle mr-2"></i>Completed</span>'}
                </div>
                <div class="space-y-4">${exercisesHtml}</div>
            </div>
        `;
    }

    async function completeWorkout(planId) {
        if (!confirm('Are you sure you want to mark this workout as complete? This may update your PRs.')) return;
        await apiRequest(`/api/gym/plan/${planId}/complete`, 'PUT');
        await renderTodaysWorkout();
        await renderDashboardMetrics(); // To remove notification
        await renderSchedule(); // To update color
    }

    async function renderGymPlanner() {
        const container = document.getElementById('gym-planner');
        container.innerHTML = '<p class="text-gray-400">Loading planner...</p>';

        const startDate = gymPlannerState.currentWeekStartDate;
        const plansByDay = await apiRequest(`/api/gym/planner?start_date=${formatDateForAPI(startDate)}`);
        
        let daysHtml = '';
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startDate);
            dayDate.setDate(startDate.getDate() + i);
            const dateStr = formatDateForAPI(dayDate);
            
            const plans = plansByDay[dateStr] || [];
            let plansHtml = plans.map(p => `
                <div class="bg-gray-700 p-2 rounded-md text-sm mb-2 ${p.completed ? 'border-l-4 border-green-500' : ''}">
                    <p class="font-bold">${p.name}</p>
                    <p class="text-xs text-gray-400">${p.start_time ? p.start_time.substring(0,5) : ''}</p>
                </div>
            `).join('');

            daysHtml += `
                <div class="bg-gray-800 rounded-lg p-3">
                    <div class="font-semibold text-center mb-2">${dayDate.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div class="text-gray-400 text-center text-sm mb-3">${dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    <div class="space-y-2">${plansHtml}</div>
                    <button id="addGymPlanBtn" data-date="${dateStr}" class="w-full mt-3 text-sm bg-blue-600/50 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded-lg">+ Add Session</button>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <button id="prevWeekBtn" class="bg-gray-700 p-2 rounded-lg"><i class="fas fa-chevron-left"></i></button>
                <h2 class="text-xl font-semibold">${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
                <button id="nextWeekBtn" class="bg-gray-700 p-2 rounded-lg"><i class="fas fa-chevron-right"></i></button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-7 gap-4">${daysHtml}</div>
        `;
    }

    function changeWeek(days) {
        gymPlannerState.currentWeekStartDate.setDate(gymPlannerState.currentWeekStartDate.getDate() + days);
        renderGymPlanner();
    }

    async function openGymPlanModal(date) {
        const modal = document.getElementById('gymPlanModal');
        const exercises = await apiRequest('/api/gym/exercises');
        const exerciseOptions = exercises.map(ex => `<option value="${ex.id}">${ex.name}</option>`).join('');

        modal.innerHTML = `
            <div class="modal-content max-w-2xl">
                <span class="close-modal">&times;</span>
                <h2 class="text-xl font-bold mb-4">Plan Workout for ${date}</h2>
                <input type="hidden" id="gymPlanDate" value="${date}">
                <div class="space-y-4">
                    <input type="text" id="gymPlanName" placeholder="Workout Name (e.g., Push Day)" class="bg-gray-700 w-full p-2 rounded">
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="text-sm">Start Time</label><input type="time" id="gymPlanStart" class="bg-gray-700 w-full p-2 rounded"></div>
                        <div><label class="text-sm">End Time</label><input type="time" id="gymPlanEnd" class="bg-gray-700 w-full p-2 rounded"></div>
                    </div>
                    <h3 class="font-semibold mt-4">Exercises</h3>
                    <div id="gymPlanExercisesContainer" class="space-y-2">
                        <!-- Exercise rows will be added here -->
                    </div>
                    <button id="addExerciseToPlan" class="text-sm text-blue-400">+ Add Exercise</button>
                    <button id="saveGymPlanBtn" class="w-full bg-blue-600 p-2 rounded mt-4">Save Plan</button>
                </div>
            </div>
        `;

        function addExerciseRow() {
            const div = document.createElement('div');
            div.className = 'grid grid-cols-12 gap-2 items-center';
            div.innerHTML = `
                <select class="col-span-5 bg-gray-600 p-1 rounded text-sm plan-exercise-id">${exerciseOptions}</select>
                <input type="text" placeholder="Sets" class="col-span-2 bg-gray-600 p-1 rounded text-sm plan-exercise-sets">
                <input type="text" placeholder="Reps" class="col-span-2 bg-gray-600 p-1 rounded text-sm plan-exercise-reps">
                <input type="text" placeholder="Weight" class="col-span-2 bg-gray-600 p-1 rounded text-sm plan-exercise-weight">
                <button class="col-span-1 text-red-400 remove-exercise-row">&times;</button>
            `;
            div.querySelector('.remove-exercise-row').onclick = () => div.remove();
            modal.querySelector('#gymPlanExercisesContainer').appendChild(div);
        }

        modal.querySelector('#addExerciseToPlan').onclick = addExerciseRow;
        addExerciseRow(); // Start with one row
        modal.style.display = 'flex';
    }

    async function saveGymPlan() {
        const modal = document.getElementById('gymPlanModal');
        const exerciseRows = modal.querySelectorAll('#gymPlanExercisesContainer > div');
        
        let exercises = [];
        exerciseRows.forEach(row => {
            const exercise_id = row.querySelector('.plan-exercise-id').value;
            const sets = row.querySelector('.plan-exercise-sets').value;
            const reps = row.querySelector('.plan-exercise-reps').value;
            const weight = row.querySelector('.plan-exercise-weight').value;
            if (exercise_id && sets && reps) {
                exercises.push({ exercise_id, sets, reps, weight });
            }
        });

        if (exercises.length === 0) {
            alert('Please add at least one exercise.');
            return;
        }

        const data = {
            date: modal.querySelector('#gymPlanDate').value,
            name: modal.querySelector('#gymPlanName').value || 'Workout',
            start_time: modal.querySelector('#gymPlanStart').value,
            end_time: modal.querySelector('#gymPlanEnd').value,
            exercises: exercises
        };
        
        if (!data.start_time || !data.end_time) {
            alert('Please set a start and end time.');
            return;
        }

        await apiRequest('/api/gym/planner', 'POST', data);
        modal.style.display = 'none';
        await renderGymPlanner();
        await renderSchedule();
    }

    // --- BASKETBALL FUNCTIONS (Updated) ---

    async function renderPlayerStats() {
        const { stats } = await apiRequest('/api/basketball/data');
        const container = document.getElementById('bball-stats');
        
        // Added REB, STL, BLK, TOV columns
        let tableHTML = `
            <div class="bg-gray-800 p-4 rounded-lg">
                <h3 class="text-xl font-semibold mb-4">Player Stats</h3>
                <div class="mb-4 flex gap-2">
                    <input type="text" id="newPlayerNameInput" class="bg-gray-700 border border-gray-600 rounded-lg py-2 px-4 w-full md:w-1/3" placeholder="New player name...">
                    <button id="addPlayerBtn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Add Player</button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr>
                                <th class="p-2">Player</th><th>PTS</th><th>FGM/A</th><th>AST</th><th>REB</th><th>STL</th><th>BLK</th><th>TOV</th>
                            </tr>
                        </thead>
                        <tbody>`;
        stats.forEach(p => {
            tableHTML += `<tr>
                <td class="p-2">${p.name}</td><td class="p-2">${p.PTS}</td><td class="p-2">${p.FGM}/${p.FGA}</td>
                <td class="p-2">${p.AST}</td><td class="p-2">${p.REB}</td><td class="p-2">${p.STL}</td>
                <td class="p-2">${p.BLK}</td><td class="p-2">${p.TOV}</td>
            </tr>`;
        });
        tableHTML += '</tbody></table></div></div>';
        container.innerHTML = tableHTML;
    }

    async function addPlayer() {
        const input = document.getElementById('newPlayerNameInput');
        const name = input.value.trim();
        if (name) {
            await apiRequest('/api/basketball/players', 'POST', { name });
            input.value = '';
            renderPlayerStats();
        }
    }

    async function openTaggingModal() {
        // ... unchanged, but backend now supports more stat_types
    }

    function renderGameReport() {
        // This function now just ensures the initial state is correct.
        // The main logic is in generateAndDisplayReport.
        const reportContent = document.getElementById('report-content');
        reportContent.innerHTML = '<p class="text-gray-400">Click the button to generate a report.</p>';
    }

    async function generateAndDisplayReport() {
        const { stats } = await apiRequest('/api/basketball/data');
        const reportContent = document.getElementById('report-content');
        
        if (!stats || stats.length === 0) {
            reportContent.innerHTML = '<p class="text-red-400">No player data available to generate a report.</p>';
            return;
        }

        const headers = ["Player", "PTS", "FGM", "FGA", "FG%", "AST", "REB", "STL", "BLK", "TOV"];
        const body = stats.map(p => [
            p.name,
            p.PTS,
            p.FGM,
            p.FGA,
            p.FGA > 0 ? ((p.FGM / p.FGA) * 100).toFixed(1) : '0.0',
            p.AST,
            p.REB,
            p.STL,
            p.BLK,
            p.TOV
        ]);

        // Display as HTML table
        let tableHtml = `<table class="w-full text-left report-table"><thead><tr>${headers.map(h => `<th class="p-2">${h}</th>`).join('')}</tr></thead><tbody>`;
        body.forEach(row => {
            tableHtml += `<tr>${row.map(cell => `<td class="p-2 border-t border-gray-700">${cell}</td>`).join('')}</tr>`;
        });
        tableHtml += '</tbody></table>';
        reportContent.innerHTML = tableHtml;

        // PDF Generation Logic
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.text("Player Performance Report", 14, 16);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

        doc.autoTable({
            head: [headers],
            body: body,
            startY: 25,
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74] },
        });
        
        doc.save('basketball-report.pdf');
    }

    // --- UTILITY FUNCTIONS ---
    function getStartOfWeek(d) {
        d = new Date(d);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        return new Date(d.setDate(diff));
    }
    function formatDateForAPI(date) {
        return date.toISOString().split('T')[0];
    }
    function formatTime(seconds, short = false) { if (isNaN(seconds) || seconds < 0) return "0m"; const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); return short ? `${h}h ${m}m` : `${h}h ${m}m`; }
    function getColor(colorName) { const colors = { red: '248, 113, 113', green: '74, 222, 128', blue: '96, 165, 250', indigo: '129, 140, 248', purple: '167, 139, 250', yellow: '250, 204, 21', teal: '45, 212, 191' }; return colors[colorName] || colors.blue; }
    function timeToMinutes(timeStr) { if(!timeStr) return 0; const [hours, minutes] = timeStr.split(':').map(Number); return hours * 60 + minutes; }

    // --- INITIALIZATION ---
    setupNavigation();
    loadPageData('dashboard'); // Load initial page
});
