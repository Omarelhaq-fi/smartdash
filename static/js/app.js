document.addEventListener('DOMContentLoaded', function() {
    // --- STATE & UI SELECTORS ---
    let weeklyChart, currentFlashcardState = {}, tempShotData = {};
    const pages = document.querySelectorAll('.page');
    const navLinks = document.querySelectorAll('.sidebar-icon');
    const darkModeToggle = document.getElementById('darkModeToggle');

    // --- API HELPER ---
    async function apiRequest(url, method = 'GET', body = null) {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) options.body = JSON.stringify(body);
        try {
            const response = await fetch(url, options);
            const contentType = response.headers.get("content-type");

            if (!response.ok) {
                let errorData;
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                } else {
                    const errorText = await response.text();
                    throw new Error(`Server returned a non-JSON error (status: ${response.status}): ${errorText.substring(0, 200)}...`);
                }
            }
            
            if (contentType && contentType.indexOf("application/json") !== -1) {
                return response.json();
            } else {
                return; // Handle non-json responses gracefully (e.g. for DELETE)
            }
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
                document.getElementById(targetId).classList.remove('hidden');
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
                document.getElementById(targetId).classList.remove('hidden');
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                loadTabData(parentPageId, targetId);
            });
        });
    }

    function loadPageData(pageId) {
        switch(pageId) {
            case 'dashboard': renderDashboardMetrics(); break;
            case 'subjects': renderSubjects(); break;
            case 'courses': renderCourses(); break;
            case 'schedule': renderSchedule(); break;
            case 'planner': renderExams(); break;
            case 'pomodoro': renderPomodoroAssignments(); break;
            case 'gym': loadTabData('gym', document.querySelector('.gym-tab.active').dataset.tabTarget); break;
            case 'basketball': loadTabData('basketball', document.querySelector('.bball-tab.active').dataset.tabTarget); break;
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
                case 'bball-lineups': renderLineupImpact(); break;
                case 'bball-report': renderGameReport(); break;
            }
        }
    }

    darkModeToggle.addEventListener('change', () => {
        document.documentElement.classList.toggle('dark');
        renderDashboardMetrics(); // Re-render charts with new colors
    });

    // --- EVENT DELEGATION ---
    document.body.addEventListener('click', handleGlobalClick);
    document.body.addEventListener('change', handleGlobalChange);

    function handleGlobalClick(e) {
        // Close modal on background click
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
            return;
        }
        
        const targetButton = e.target.closest('button, a, .close-modal, .delete-schedule-btn');
        if (!targetButton && !e.target.closest('.flashcard') && e.target.id !== 'shot-chart-container') return;
        
        if (targetButton && targetButton.closest('.close-modal')) {
             targetButton.closest('.modal').style.display = 'none';
             return;
        }
        
        const id = targetButton ? targetButton.id : (e.target.id || e.target.closest('.flashcard')?.id);

        const actions = {
            'addSubjectBtn': addSubject, 'addExamBtn': addExam, 'addMistakeBtn': openMistakeModal, 'saveMistakeBtn': saveMistake,
            'addCourseBtn': openCourseModal, 'saveCourseBtn': saveCourse, 'addCustomEventBtn': openCustomEventModal, 'saveCustomEventBtn': saveCustomEvent,
            'addExerciseBtn': openExerciseModal, 'saveExerciseBtn': saveExercise, 'import-video-btn': () => document.getElementById('video-upload').click(),
            'add-tag-btn': openTaggingModal, 'saveTagBtn': saveTag, 'shot-made-btn': () => logShot(true), 'shot-missed-btn': () => logShot(false),
            'flipFlashcard': () => document.querySelector('.flashcard').classList.toggle('is-flipped'), 'prevFlashcard': () => navigateFlashcard(-1), 'nextFlashcard': () => navigateFlashcard(1),
            'addFlashcardBtn': addFlashcard, 'startStopBtn': () => isRunning ? stopTimer() : startTimer(), 'resetTimerBtn': resetTimer, 'skipBtn': () => switchMode(true),
            'addPlayerBtn': addPlayer,
            'addGymScheduleBtn': openGymScheduleModal, 'saveGymScheduleBtn': saveGymSchedule,
        };

        if (actions[id]) {
             actions[id]();
        } else if (targetButton?.classList.contains('add-lecture')) {
            addLecture(targetButton.dataset.subjectId);
        } else if (targetButton?.closest('.open-flashcards')) {
            const subjectId = targetButton.closest('[data-subject-id]').dataset.subjectId;
            const lectureId = targetButton.closest('[data-lecture-id]').dataset.lectureId;
            openFlashcardModal(subjectId, lectureId);
        } else if (targetButton?.classList.contains('edit-exercise-btn')) {
            openExerciseModal(targetButton.dataset.exerciseId);
        } else if (targetButton?.classList.contains('delete-schedule-btn')) {
            deleteGymSchedule(targetButton.dataset.scheduleId);
        } else if (e.target.id === 'shot-chart-container') {
            handleShotChartClick(e);
        }
    }

    function handleGlobalChange(e) {
        const target = e.target;
        if (target.closest('.lecture-table-input')) updateLecture(target);
        if (target.id === 'video-upload') importVideo(target);
    }

    // --- RENDER FUNCTIONS (Dashboard, Subjects, Courses etc. are mostly unchanged) ---
    async function renderDashboardMetrics() { /* ... unchanged ... */ }
    function renderWeeklyChart() { /* ... unchanged ... */ }
    async function renderSubjects() { /* ... unchanged ... */ }
    async function addSubject() { /* ... unchanged ... */ }
    async function addLecture(subjectId) { /* ... unchanged ... */ }
    async function updateLecture(target) { /* ... unchanged ... */ }
    async function renderExams() { /* ... unchanged ... */ }
    async function addExam() { /* ... unchanged ... */ }
    async function generateReverseSchedule() { /* ... unchanged ... */ }
    async function openMistakeModal() { /* ... unchanged ... */ }
    async function saveMistake() { /* ... unchanged ... */ }
    // Pomodoro functions
    let timerInterval, isRunning = false, timeLeft = 1500, currentMode = 'pomodoro', sessionCount = 1; const modes = { pomodoro: { time: 1500, status: 'Stay Focused' }, shortBreak: { time: 300, status: 'Short Break' }, longBreak: { time: 900, status: 'Long Break' } }; function updateTimerDisplay() { const timerDisplay = document.getElementById('timer'); if (!timerDisplay) return; const minutes = Math.floor(timeLeft / 60); const seconds = timeLeft % 60; timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`; const totalSeconds = modes[currentMode].time; const percentage = ((totalSeconds - timeLeft) / totalSeconds) * 360; document.getElementById('pomodoroDial').style.background = `conic-gradient(#38bdf8 ${percentage}deg, #2d3748 ${percentage}deg)`; } function startTimer() { if (isRunning) return; isRunning = true; document.getElementById('startStopBtn').innerHTML = '<i class="fas fa-pause"></i>'; timerInterval = setInterval(() => { timeLeft--; updateTimerDisplay(); if (timeLeft <= 0) { clearInterval(timerInterval); if (currentMode === 'pomodoro') { logPomodoroSession(); } switchMode(); } }, 1000); } function stopTimer() { if (!isRunning) return; isRunning = false; document.getElementById('startStopBtn').innerHTML = '<i class="fas fa-play"></i>'; clearInterval(timerInterval); } function resetTimer() { stopTimer(); timeLeft = modes[currentMode].time; updateTimerDisplay(); } function switchMode(forceNext = false) { stopTimer(); if (currentMode === 'pomodoro') { if (!forceNext) sessionCount++; currentMode = sessionCount % 4 === 0 ? 'longBreak' : 'shortBreak'; } else { currentMode = 'pomodoro'; } timeLeft = modes[currentMode].time; document.getElementById('timer-status').textContent = modes[currentMode].status; document.getElementById('session-tracker').textContent = `${Math.ceil(sessionCount/2)} / 4 Sessions`; updateTimerDisplay(); } async function logPomodoroSession() { const duration = modes.pomodoro.time; const assigned = document.getElementById('pomodoroSubjectAssign').value; let [subjectId, lectureId] = assigned ? assigned.split('-').map(Number) : [null, null]; await apiRequest('/api/pomodoro', 'POST', { duration, subject_id: subjectId, lecture_id: lectureId }); renderDashboardMetrics(); }
    async function renderPomodoroAssignments() { /* ... unchanged ... */ }
    // Flashcard functions
    async function openFlashcardModal(subjectId, lectureId) { /* ... unchanged ... */ }
    function renderFlashcard() { /* ... unchanged ... */ }
    function navigateFlashcard(direction) { /* ... unchanged ... */ }
    async function addFlashcard() { /* ... unchanged ... */ }
    // Course functions
    async function renderCourses() { /* ... unchanged ... */ }
    function openCourseModal() { /* ... unchanged ... */ }
    async function saveCourse() { /* ... unchanged ... */ }
    // Schedule functions
    async function renderSchedule() {
        const events = await apiRequest('/api/schedule');
        const container = document.getElementById('timeline-container');
        if (!container) return;
        container.innerHTML = '';
        // Create hour markers
        for (let i = 0; i < 24; i++) {
            container.innerHTML += `<div class="timeline-hour"><span class="timeline-hour-label">${i.toString().padStart(2, '0')}:00</span></div>`;
        }
        // Add events to timeline
        events.forEach(e => {
            const startMinutes = timeToMinutes(e.start_time);
            const endMinutes = timeToMinutes(e.end_time);
            const duration = Math.max(0, endMinutes - startMinutes);
            const bgColor = e.color === 'red' ? 'rgba(248, 113, 113, 0.5)' : `rgba(${getColor(e.color)}, 0.5)`;
            const borderColor = e.color === 'red' ? 'rgb(248, 113, 113)' : `rgb(${getColor(e.color)})`;
            
            container.innerHTML += `<div class="timeline-event" style="top:${startMinutes}px; height:${duration}px; background-color:${bgColor}; border-color:${borderColor};"><p class="font-bold">${e.title}</p></div>`;
        });
    }
    function openCustomEventModal() { /* ... unchanged ... */ }
    async function saveCustomEvent() { /* ... unchanged ... */ }

    // --- GYM FUNCTIONS ---
    async function renderTodaysWorkout() {
        const container = document.getElementById('gym-today');
        const allSchedules = await apiRequest('/api/gym/schedule');
        const todayString = getTodayDateString();
        const todaysWorkout = allSchedules.find(s => s.date === todayString);

        if (todaysWorkout) {
            container.innerHTML = `
                <div class="bg-gray-800 p-6 rounded-lg">
                    <h2 class="text-2xl font-semibold mb-2">${todaysWorkout.workout_name}</h2>
                    <p class="text-blue-400 mb-4"><i class="far fa-clock mr-2"></i>${formatTimeForDisplay(todaysWorkout.start_time)} - ${formatTimeForDisplay(todaysWorkout.end_time)}</p>
                    <div class="prose prose-invert max-w-none">
                        <p>${todaysWorkout.notes || 'No specific notes for today.'}</p>
                    </div>
                </div>`;
        } else {
            container.innerHTML = `
                <div class="bg-gray-800 p-6 rounded-lg text-center">
                    <i class="fas fa-couch fa-3x text-gray-500 mb-4"></i>
                    <h2 class="text-2xl font-semibold">Rest Day</h2>
                    <p class="text-gray-400">No workout scheduled for today. Enjoy your rest!</p>
                </div>`;
        }
    }
    
    async function renderGymPlanner() {
        const container = document.getElementById('gym-planner');
        const schedules = await apiRequest('/api/gym/schedule');
        
        let scheduleHtml = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-semibold">Workout Schedule</h2>
                <button id="addGymScheduleBtn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">
                    <i class="fas fa-plus mr-2"></i>Add Schedule
                </button>
            </div>
            <div class="space-y-4">`;

        if (schedules.length === 0) {
            scheduleHtml += '<p class="text-gray-400">No workouts scheduled yet. Add one to get started!</p>';
        } else {
            schedules.forEach(s => {
                scheduleHtml += `
                    <div class="bg-gray-800 p-4 rounded-lg flex items-center justify-between">
                        <div>
                            <p class="text-sm text-blue-400">${formatDateForDisplay(s.date)}</p>
                            <p class="font-bold text-lg">${s.workout_name}</p>
                            <p class="text-xs text-gray-400">${formatTimeForDisplay(s.start_time)} - ${formatTimeForDisplay(s.end_time)}</p>
                        </div>
                        <button class="delete-schedule-btn text-red-500 hover:text-red-400" data-schedule-id="${s.id}">
                            <i class="fas fa-trash-alt fa-lg"></i>
                        </button>
                    </div>`;
            });
        }
        scheduleHtml += '</div>';
        container.innerHTML = scheduleHtml;
    }

    function openGymScheduleModal() {
        const modal = document.getElementById('gymScheduleModal');
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal absolute top-4 right-6 text-2xl font-bold cursor-pointer">&times;</span>
                <h2 class="text-xl font-bold mb-4">Add Workout to Schedule</h2>
                <div class="space-y-4">
                    <input type="text" id="gymScheduleNameInput" placeholder="Workout Name (e.g., Push Day)" class="bg-gray-700 w-full p-2 rounded">
                    <div><label class="text-sm text-gray-400">Date</label><input type="date" id="gymScheduleDateInput" class="bg-gray-700 w-full p-2 rounded"></div>
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="text-sm text-gray-400">Start Time</label><input type="time" id="gymScheduleStartInput" class="bg-gray-700 w-full p-2 rounded"></div>
                        <div><label class="text-sm text-gray-400">End Time</label><input type="time" id="gymScheduleEndInput" class="bg-gray-700 w-full p-2 rounded"></div>
                    </div>
                    <textarea id="gymScheduleNotesInput" placeholder="Notes (e.g., exercises, focus areas)" class="bg-gray-700 w-full p-2 rounded h-24"></textarea>
                    <button id="saveGymScheduleBtn" class="w-full bg-blue-600 p-2 rounded">Save Schedule</button>
                </div>
            </div>`;
        modal.style.display = 'flex';
    }

    async function saveGymSchedule() {
        const modal = document.getElementById('gymScheduleModal');
        const data = {
            workout_name: modal.querySelector('#gymScheduleNameInput').value,
            date: modal.querySelector('#gymScheduleDateInput').value,
            start_time: modal.querySelector('#gymScheduleStartInput').value,
            end_time: modal.querySelector('#gymScheduleEndInput').value,
            notes: modal.querySelector('#gymScheduleNotesInput').value,
        };

        if (!data.workout_name || !data.date || !data.start_time || !data.end_time) {
            alert('Please fill out all fields.');
            return;
        }

        await apiRequest('/api/gym/schedule', 'POST', data);
        modal.style.display = 'none';
        renderGymPlanner();
        renderTodaysWorkout(); // Update today's view in case the added workout is for today
        renderSchedule(); // Update main schedule as well
    }
    
    async function deleteGymSchedule(scheduleId) {
        if (confirm('Are you sure you want to delete this scheduled workout?')) {
            await apiRequest(`/api/gym/schedule/${scheduleId}`, 'DELETE');
            renderGymPlanner();
            renderTodaysWorkout();
            renderSchedule();
        }
    }

    async function renderExerciseLibrary() { /* ... unchanged ... */ }
    async function renderPrLog() { /* ... unchanged ... */ }
    function openExerciseModal(exerciseId = null) { /* ... unchanged ... */ }
    async function saveExercise() { /* ... unchanged ... */ }

    // --- BASKETBALL FUNCTIONS ---
    async function addPlayer() { /* ... unchanged ... */ }
    function importVideo(target) { /* ... unchanged ... */ }
    async function openTaggingModal() { /* ... unchanged ... */ }
    async function saveTag() { /* ... unchanged ... */ }
    function handleShotChartClick(e) { /* ... unchanged ... */ }
    async function logShot(made) { /* ... unchanged ... */ }
    async function renderTimeline() { /* ... unchanged ... */ }
    async function renderShotChart() { /* ... unchanged ... */ }
    async function renderPlayerStats() {
        const data = await apiRequest('/api/basketball/data');
        const stats = data.stats;
        const container = document.getElementById('bball-stats');
        let tableHTML = `
            <div class="bg-gray-800 p-4 rounded-lg">
                <h3 class="text-xl font-semibold mb-4">Player Stats</h3>
                <div class="mb-4 flex gap-2">
                    <input type="text" id="newPlayerNameInput" class="bg-gray-700 border border-gray-600 rounded-lg py-2 px-4 w-full md:w-1/3" placeholder="New player name...">
                    <button id="addPlayerBtn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Add Player</button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead><tr><th>Player</th><th>PTS</th><th>FGM/A</th><th>AST</th></tr></thead>
                        <tbody>`;
        stats.forEach(p => { tableHTML += `<tr><td class="p-2">${p.name}</td><td class="p-2">${p.PTS}</td><td class="p-2">${p.FGM}/${p.FGA}</td><td class="p-2">${p.AST}</td></tr>`; });
        tableHTML += '</tbody></table></div></div>';
        container.innerHTML = tableHTML;
    }
    function renderLineupImpact() { /* ... unchanged ... */ }
    function renderGameReport() { /* ... unchanged ... */ }

    // --- UTILITY FUNCTIONS ---
    function formatTime(seconds, short = false) { if (isNaN(seconds) || seconds < 0) return "0m"; const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); return short ? `${h}h ${m}m` : `${h}h ${m}m`; }
    function formatVideoTime(timeInSeconds) { const minutes = Math.floor(timeInSeconds / 60); const seconds = Math.floor(timeInSeconds % 60); return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`; }
    function getColor(colorName) { const colors = { red: '248, 113, 113', green: '74, 222, 128', blue: '96, 165, 250', indigo: '129, 140, 248', purple: '167, 139, 250', yellow: '250, 204, 21', teal: '45, 212, 191' }; return colors[colorName] || colors.blue; }
    function timeToMinutes(timeStr) { const [hours, minutes] = timeStr.split(':').map(Number); return hours * 60 + minutes; }
    function getTodayDateString() { const today = new Date(); const year = today.getFullYear(); const month = (today.getMonth() + 1).toString().padStart(2, '0'); const day = today.getDate().toString().padStart(2, '0'); return `${year}-${month}-${day}`; }
    function formatTimeForDisplay(timeStr) { const [h, m] = timeStr.split(':'); const hour = parseInt(h, 10); const ampm = hour >= 12 ? 'PM' : 'AM'; const formattedHour = hour % 12 || 12; return `${formattedHour}:${m} ${ampm}`; }
    function formatDateForDisplay(dateStr) { const date = new Date(dateStr + 'T00:00:00'); return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });}

    // --- NEW: Time Popup Function ---
    function showCairoTimePopup() {
        const modal = document.getElementById('timePopupModal');
        if (!modal) return;

        try {
            const now = new Date();
            // Get time in Cairo (UTC+3 is EEST, standard is EET UTC+2). 'Africa/Cairo' handles DST.
            const cairoTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));

            const timeString = cairoTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
            const dateString = cairoTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            document.getElementById('cairoTimeDisplay').textContent = timeString;
            document.getElementById('cairoDateDisplay').textContent = dateString;
            modal.style.display = 'flex';

            // Hide after 5 seconds
            setTimeout(() => { modal.style.display = 'none'; }, 5000);
            
            // Also allow clicking to close
            modal.addEventListener('click', () => { modal.style.display = 'none'; });

        } catch (error) {
            console.error("Could not display Cairo time:", error);
        }
    }


    // --- INITIALIZATION ---
    setupNavigation();
    loadPageData('dashboard'); // Load initial page
    updateTimerDisplay();
    showCairoTimePopup(); // Show the time popup on load
});
