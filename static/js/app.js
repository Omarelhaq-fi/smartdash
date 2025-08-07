document.addEventListener('DOMContentLoaded', function() {
    // --- STATE & UI SELECTORS ---
    let weeklyChart, currentFlashcardState = {}, tempShotData = {};
    const pages = document.querySelectorAll('.page');
    const navLinks = document.querySelectorAll('.sidebar-icon');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const mainModal = document.getElementById('mainModal');

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
                return; 
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
            case 'gym': loadTabData('gym', 'gym-today'); break;
            case 'basketball': loadTabData('basketball', 'bball-stats'); break;
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
        renderDashboardMetrics();
    });

    // --- EVENT DELEGATION ---
    document.body.addEventListener('click', handleGlobalClick);
    document.body.addEventListener('change', handleGlobalChange);

    function handleGlobalClick(e) {
        if (e.target.classList.contains('modal')) {
            mainModal.style.display = 'none';
            return;
        }
        
        const targetButton = e.target.closest('button, a, .close-modal');
        if (!targetButton && !e.target.closest('.flashcard, .course-card') && e.target.id !== 'shot-chart-container') return;
        
        if (targetButton && targetButton.closest('.close-modal')) {
             mainModal.style.display = 'none';
             return;
        }
        
        const id = targetButton ? targetButton.id : (e.target.id || e.target.closest('.flashcard, .course-card')?.id);

        const actions = {
            'addSubjectBtn': addSubject, 'addExamBtn': addExam, 'addMistakeBtn': () => openModal('mistake'),
            'addCourseBtn': () => openModal('course'), 'saveCourseBtn': saveCourse, 'addCustomEventBtn': () => openModal('customEvent'), 'saveCustomEventBtn': saveCustomEvent,
            'addExerciseBtn': () => openModal('exercise'), 'saveExerciseBtn': saveExercise, 'import-video-btn': () => document.getElementById('video-upload').click(),
            'add-tag-btn': () => openModal('tagging'), 'saveTagBtn': saveTag, 'shot-made-btn': () => logShot(true), 'shot-missed-btn': () => logShot(false),
            'flipFlashcard': () => document.querySelector('.flashcard').classList.toggle('is-flipped'), 'prevFlashcard': () => navigateFlashcard(-1), 'nextFlashcard': () => navigateFlashcard(1),
            'addFlashcardBtn': addFlashcard, 'startStopBtn': () => isRunning ? stopTimer() : startTimer(), 'resetTimerBtn': resetTimer, 'skipBtn': () => switchMode(true),
            'addPlayerBtn': addPlayer, 'downloadReportBtn': downloadPlayerReport, 'addGoalBtn': addGoal, 'saveGymPlannerBtn': saveGymPlanner,
            'resetSubjectsBtn': () => resetData('subjects'), 'resetCoursesBtn': () => resetData('courses'), 'resetGymBtn': () => resetData('gym'), 'resetBasketballBtn': () => resetData('basketball'),
        };

        if (actions[id]) actions[id]();
        else if (targetButton?.classList.contains('add-lecture')) addLecture(targetButton.dataset.subjectId);
        else if (targetButton?.classList.contains('start-pomodoro-lecture')) {
            const { subjectId, lectureId } = targetButton.dataset;
            document.getElementById('pomodoroSubjectAssign').value = `${subjectId}-${lectureId}`;
            navLinks.forEach(link => { if(link.dataset.target === 'pomodoro') link.click(); });
        }
        else if (targetButton?.closest('.open-flashcards')) {
            const subjectId = targetButton.closest('[data-subject-id]').dataset.subjectId;
            const lectureId = targetButton.closest('[data-lecture-id]').dataset.lectureId;
            openModal('flashcard', {subjectId, lectureId});
        } 
        else if (targetButton?.closest('.course-card')) {
            openModal('courseUnits', {courseId: targetButton.closest('.course-card').dataset.courseId});
        }
        else if (targetButton?.classList.contains('edit-exercise-btn')) {
            openModal('exercise', {exerciseId: targetButton.dataset.exerciseId});
        } else if (e.target.id === 'shot-chart-container') {
            handleShotChartClick(e);
        }
    }

    async function handleGlobalChange(e) {
        const target = e.target;
        if (target.closest('.lecture-table-input')) {
            await updateLecture(target);
            renderDashboardMetrics();
        }
        if (target.id === 'video-upload') importVideo(target);
        if (target.classList.contains('goal-checkbox')) updateGoal(target);
        if (target.classList.contains('course-unit-checkbox')) updateCourseUnit(target);
    }
    
    // --- GENERIC MODAL HANDLER ---
    async function openModal(type, data = {}) {
        let content = '';
        switch(type) {
            case 'courseUnits':
                const course = (await apiRequest('/api/courses')).find(c => c.id == data.courseId);
                const unitsHtml = course.units.map(u => `
                    <div class="flex items-center">
                        <input type="checkbox" id="unit-${u.id}" data-unit-id="${u.id}" class="course-unit-checkbox w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded" ${u.is_complete ? 'checked' : ''}>
                        <label for="unit-${u.id}" class="ml-2 text-sm font-medium">Unit ${u.unit_number}</label>
                    </div>`).join('');
                content = `<div class="modal-content"><span class="close-modal">&times;</span><h2 class="text-xl font-bold mb-4">${course.title} - Units</h2><div class="space-y-2">${unitsHtml}</div></div>`;
                break;
            // Other cases for mistake, course, etc. would go here
        }
        mainModal.innerHTML = content;
        mainModal.style.display = 'flex';
    }

    // --- RENDER FUNCTIONS ---
    async function renderDashboardMetrics() {
        const data = await apiRequest('/api/dashboard_metrics');
        const { lectures, gym, courses } = data.goals;
        document.getElementById('lectureProgress').textContent = `${lectures.current}/${lectures.target}`;
        document.getElementById('lectureProgressBar').style.width = `${(lectures.current / lectures.target) * 100}%`;
        document.getElementById('gymProgress').textContent = `${gym.current}/${gym.target}`;
        document.getElementById('gymProgressBar').style.width = `${(gym.current / gym.target) * 100}%`;
        document.getElementById('courseProgress').textContent = `${courses.current}/${courses.target}`;
        document.getElementById('courseProgressBar').style.width = `${(courses.current / courses.target) * 100}%`;
        document.getElementById('pomodoroDaily').textContent = formatTime(data.pomodoro.daily, true);
        document.getElementById('pomodoroWeekly').textContent = formatTime(data.pomodoro.weekly, true);
        document.getElementById('pomodoroMonthly').textContent = formatTime(data.pomodoro.monthly, true);
        const examContainer = document.getElementById('examCountdownContainer');
        examContainer.innerHTML = data.exams.length === 0 ? '<p class="text-gray-400">No upcoming exams.</p>' : data.exams.map(exam => `<div class="mb-2"><p><strong>${exam.name}</strong> is in <span class="text-blue-400 font-bold">${Math.max(0, Math.ceil((new Date(exam.date) - new Date()) / (1000 * 60 * 60 * 24)))} days</span></p></div>`).join('');
        const weakTopicsList = document.getElementById('weakTopicsList');
        weakTopicsList.innerHTML = data.weak_topics.length === 0 ? '<li>No mistakes logged.</li>' : data.weak_topics.map(m => `<li>${m.topic} (${m.subject_name})</li>`).join('');
        renderWeeklyChart();
    }
    
    async function renderSubjects() {
        const subjects = await apiRequest('/api/subjects');
        const container = document.getElementById('subjectsContainer');
        container.innerHTML = '';
        if (subjects.length === 0) { container.innerHTML = '<p class="text-gray-400">No subjects added yet. Add one above!</p>'; return; }
        subjects.forEach(s => {
            const el = document.createElement('div');
            el.className = 'bg-gray-800 p-6 rounded-lg';
            const lecturesHtml = s.lectures.map(l => {
                const isFinished = l.uni_lecs > 0 && l.studied >= l.uni_lecs;
                return `<tr class="${isFinished ? 'bg-green-900/50' : ''}">
                    <td class="p-2">${l.lecture_number}</td>
                    <td class="p-2"><input type="number" value="${l.uni_lecs}" class="w-16 bg-gray-700 p-1 rounded lecture-table-input" data-type="uni_lecs" data-lecture-id="${l.id}"></td>
                    <td class="p-2"><input type="number" value="${l.studied}" class="w-16 bg-gray-700 p-1 rounded lecture-table-input" data-type="studied" data-lecture-id="${l.id}"></td>
                    <td class="p-2">${l.pomodoros_done || 0}</td>
                    <td class="p-2"><label class="toggle-switch"><input type="checkbox" ${l.revised ? 'checked' : ''} class="lecture-table-input" data-type="revised" data-lecture-id="${l.id}"><span class="slider"></span></label></td>
                    <td class="p-2 space-x-2"><button class="text-blue-400 open-flashcards" data-subject-id="${s.id}" data-lecture-id="${l.lecture_number}"><i class="fas fa-clone"></i></button><button class="text-orange-400 start-pomodoro-lecture" data-subject-id="${s.id}" data-lecture-id="${l.id}"><i class="fas fa-clock"></i></button></td>
                </tr>`;
            }).join('');
            el.innerHTML = `<h2 class="text-xl font-semibold mb-4">${s.name}</h2><div class="overflow-x-auto"><table class="w-full text-left"><thead><tr><th>Lec#</th><th>Univ.</th><th>Studied</th><th>Pomos</th><th>Revised</th><th>Actions</th></tr></thead><tbody>${lecturesHtml}</tbody></table></div><button class="mt-4 text-sm text-blue-400 add-lecture" data-subject-id="${s.id}">+ Add Lecture</button>`;
            container.appendChild(el);
        });
    }

    async function updateLecture(target) {
        const lectureId = target.dataset.lectureId;
        const row = target.closest('tr');
        const data = { uni_lecs: parseInt(row.querySelector('[data-type="uni_lecs"]').value), studied: parseInt(row.querySelector('[data-type="studied"]').value), revised: row.querySelector('[data-type="revised"]').checked };
        await apiRequest(`/api/lectures/${lectureId}`, 'PUT', data);
    }
    
    // --- Course & Goal Functions ---
    async function renderCourses() {
        const courses = await apiRequest('/api/courses');
        const container = document.getElementById('courseLibraryContainer');
        container.innerHTML = courses.length === 0 ? '<p class="text-gray-400 md:col-span-2">No courses added.</p>' : courses.map(c => {
            const progress = c.total_units > 0 ? (c.completed_units / c.total_units) * 100 : 0;
            return `<div class="bg-gray-700 p-4 rounded-lg course-card cursor-pointer" data-course-id="${c.id}">
                <h3 class="font-bold">${c.title}</h3><p class="text-sm text-gray-400">${c.platform} - ${c.category}</p>
                <div class="mt-3"><div class="flex justify-between text-sm mb-1"><span>Progress</span><span>${Math.round(progress)}%</span></div>
                <div class="w-full bg-gray-600 rounded-full h-2.5"><div class="bg-blue-500 h-2.5 rounded-full" style="width: ${progress}%"></div></div>
                <p class="text-xs text-gray-500 mt-1">${c.completed_units}/${c.total_units} units</p></div></div>`;
        }).join('');
    }
    async function updateCourseUnit(target) {
        const unitId = target.dataset.unitId;
        const is_complete = target.checked;
        await apiRequest(`/api/course_units/${unitId}`, 'PUT', { is_complete });
        renderCourses(); // Re-render to update progress bar
    }
    async function renderGoals() {
        const goals = await apiRequest('/api/goals');
        const container = document.getElementById('goalsContainer');
        container.innerHTML = goals.map(g => `
            <div class="flex items-center"><input type="checkbox" id="goal-${g.id}" data-goal-id="${g.id}" class="goal-checkbox w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded" ${g.is_complete ? 'checked' : ''}>
            <label for="goal-${g.id}" class="ml-2 text-sm font-medium ${g.is_complete ? 'line-through text-gray-500' : ''}">${g.text}</label></div>`).join('');
    }
    async function addGoal() {
        const input = document.getElementById('newGoalInput');
        if (input.value.trim()) {
            await apiRequest('/api/goals', 'POST', { text: input.value.trim() });
            input.value = '';
            renderGoals();
        }
    }
    async function updateGoal(target) {
        const goalId = target.dataset.goalId;
        const is_complete = target.checked;
        await apiRequest(`/api/goals/${goalId}`, 'PUT', { is_complete });
        renderGoals();
    }
    
    // --- Gym Functions ---
    async function renderTodaysWorkout() {
        const workout = await apiRequest('/api/gym/today');
        const container = document.getElementById('gym-today');
        container.innerHTML = `<h2 class="text-2xl font-semibold mb-4">Today: ${workout.name}</h2>`;
        if (!workout || workout.exercises.length === 0) { container.innerHTML += '<p class="text-gray-400">Rest day!</p>'; return; }
        const workoutTable = document.createElement('div');
        workoutTable.className = 'space-y-6';
        workout.exercises.forEach(ex => {
            const historyText = ex.history ? `Last: ${ex.history.weight}kg x ${ex.history.reps} reps` : 'First time!';
            let setsHtml = Array.from({ length: 3 }, (_, i) => `<tr><td class="p-2">${i+1}</td><td class="p-2"><input type="number" class="w-20 bg-gray-700 p-1 rounded" placeholder="${ex.history?.weight || ''}"></td><td class="p-2"><input type="number" class="w-20 bg-gray-700 p-1 rounded" placeholder="${ex.history?.reps || ''}"></td><td class="p-2"><input type="checkbox" class="w-5 h-5 bg-gray-700 rounded text-blue-500 focus:ring-blue-600"></td></tr>`).join('');
            workoutTable.innerHTML += `<div class="bg-gray-800 p-4 rounded-lg"><h3 class="text-xl font-bold">${ex.name}</h3><p class="text-sm text-gray-400 mb-3"><i class="fas fa-history"></i> ${historyText}</p><table class="w-full text-center"><thead><tr><th>Set</th><th>Weight (kg)</th><th>Reps</th><th>Done</th></tr></thead><tbody>${setsHtml}</tbody></table></div>`;
        });
        container.appendChild(workoutTable);
    }
    async function renderGymPlanner() {
        const plannerData = await apiRequest('/api/gym/planner');
        const exercises = await apiRequest('/api/gym/exercises');
        const container = document.getElementById('gym-planner');
        const exerciseOptions = exercises.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
        container.innerHTML = `<h2 class="text-2xl font-semibold mb-4">Weekly Planner</h2><div id="planner-form" class="space-y-4"></div><button id="saveGymPlannerBtn" class="mt-6 w-full bg-blue-600 p-2 rounded">Save Planner</button>`;
        const form = container.querySelector('#planner-form');
        plannerData.forEach(day => {
            form.innerHTML += `<div class="bg-gray-800 p-4 rounded-lg" data-day="${day.day_of_week}">
                <h3 class="font-bold text-lg">${day.day_of_week}</h3>
                <input type="text" class="w-full bg-gray-700 p-2 rounded mt-2 planner-workout-name" placeholder="Workout Name (e.g., Push Day)" value="${day.workout_name || ''}">
                <select multiple class="w-full bg-gray-700 p-2 rounded mt-2 h-32 planner-exercise-select">${exerciseOptions}</select>
            </div>`;
            const select = form.querySelector(`[data-day="${day.day_of_week}"] select`);
            (day.exercise_ids || []).forEach(id => {
                const option = select.querySelector(`option[value="${id}"]`);
                if(option) option.selected = true;
            });
        });
    }
    async function saveGymPlanner() {
        const plannerDivs = document.querySelectorAll('#planner-form > div');
        const payload = Array.from(plannerDivs).map(div => ({
            day_of_week: div.dataset.day,
            workout_name: div.querySelector('.planner-workout-name').value,
            exercise_ids: Array.from(div.querySelector('.planner-exercise-select').selectedOptions).map(opt => parseInt(opt.value))
        }));
        await apiRequest('/api/gym/planner', 'PUT', payload);
        alert('Gym planner saved!');
        renderTodaysWorkout();
    }
    
    // --- Reset Data ---
    async function resetData(section) {
        if (confirm(`Are you sure you want to reset all ${section} data? This cannot be undone.`)) {
            await apiRequest(`/api/reset/${section}`, 'POST');
            alert(`${section} data has been reset.`);
            loadPageData(section);
        }
    }

    // --- Other Unchanged Functions ---
    async function downloadPlayerReport() { const { jsPDF } = window.jspdf; const doc = new jsPDF(); const { stats } = await apiRequest('/api/basketball/data'); doc.setFontSize(18); doc.text("Player Stats Report", 14, 22); const tableColumn = ["Player", "Points", "FGM/A", "Assists"]; const tableRows = []; stats.forEach(player => { tableRows.push([ player.name, player.PTS, `${player.FGM}/${player.FGA}`, player.AST ]); }); doc.autoTable({ head: [tableColumn], body: tableRows, startY: 30, }); doc.save('player_report.pdf'); }
    async function renderPlayerStats() { const { stats } = await apiRequest('/api/basketball/data'); const container = document.getElementById('bball-stats'); let tableHTML = `<div class="bg-gray-800 p-4 rounded-lg"><div class="flex justify-between items-center mb-4"><h3 class="text-xl font-semibold">Player Stats</h3><button id="downloadReportBtn" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg">Download Report</button></div><div class="mb-4 flex gap-2"><input type="text" id="newPlayerNameInput" class="bg-gray-700 border border-gray-600 rounded-lg py-2 px-4 w-full md:w-1/3" placeholder="New player name..."><button id="addPlayerBtn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Add Player</button></div><div class="overflow-x-auto"><table class="w-full text-left"><thead><tr><th>Player</th><th>PTS</th><th>FGM/A</th><th>AST</th></tr></thead><tbody>`; stats.forEach(p => { tableHTML += `<tr><td class="p-2">${p.name}</td><td class="p-2">${p.PTS}</td><td class="p-2">${p.FGM}/${p.FGA}</td><td class="p-2">${p.AST}</td></tr>`; }); tableHTML += '</tbody></table></div></div>'; container.innerHTML = tableHTML; }
    function renderWeeklyChart() { const ctx = document.getElementById('weeklyStudyChart').getContext('2d'); const isDark = document.documentElement.classList.contains('dark'); const gridColor = isDark ? '#4a5568' : '#e2e8f0'; const textColor = isDark ? '#a0aec0' : '#4a5568'; const data = { labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], datasets: [{ label: 'Study Hours', data: Array(7).fill(0).map(() => Math.random() * 5), backgroundColor: '#38bdf8', borderRadius: 5 }] }; if (weeklyChart) weeklyChart.destroy(); weeklyChart = new Chart(ctx, { type: 'bar', data: data, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Hours Studied', color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } }, x: { grid: { display: false }, ticks: { color: textColor } } }, plugins: { legend: { display: false } } } }); }
    async function addSubject() { const input = document.getElementById('newSubjectInput'); const name = input.value.trim(); if (name) { await apiRequest('/api/subjects', 'POST', { name }); input.value = ''; renderSubjects(); renderPomodoroAssignments(); } }
    async function addLecture(subjectId) { await apiRequest(`/api/subjects/${subjectId}/lectures`, 'POST'); renderSubjects(); renderPomodoroAssignments(); }
    async function renderExams() { generateReverseSchedule(); }
    async function addExam() { const nameInput = document.getElementById('examNameInput'); const dateInput = document.getElementById('examDateInput'); if (nameInput.value && dateInput.value) { await apiRequest('/api/exams', 'POST', { name: nameInput.value, date: dateInput.value }); nameInput.value = ''; dateInput.value = ''; renderDashboardMetrics(); generateReverseSchedule(); } }
    async function generateReverseSchedule() { const container = document.getElementById('reverseScheduleContainer'); const exams = await apiRequest('/api/exams'); const subjects = await apiRequest('/api/subjects'); if (exams.length === 0) { container.innerHTML = '<p class="text-gray-400">Add an exam to generate a schedule.</p>'; return; } const upcomingExam = exams[0]; const daysUntilExam = Math.ceil((new Date(upcomingExam.date) - new Date()) / (1000 * 60 * 60 * 24)); const totalLecturesToStudy = subjects.reduce((sum, s) => sum + s.lectures.reduce((lecSum, l) => lecSum + (l.uni_lecs - l.studied), 0), 0); const lecturesPerDay = totalLecturesToStudy > 0 && daysUntilExam > 3 ? (totalLecturesToStudy / (daysUntilExam - 3)).toFixed(1) : 0; container.innerHTML = `<h3 class="font-semibold text-lg">${upcomingExam.name} Plan</h3><p>Study <strong class="text-blue-400">${lecturesPerDay} lectures per day</strong>.</p>`; }
    let timerInterval, isRunning = false, timeLeft = 1500, currentMode = 'pomodoro', sessionCount = 1; const modes = { pomodoro: { time: 1500, status: 'Stay Focused' }, shortBreak: { time: 300, status: 'Short Break' }, longBreak: { time: 900, status: 'Long Break' } }; function updateTimerDisplay() { const timerDisplay = document.getElementById('timer'); if (!timerDisplay) return; const minutes = Math.floor(timeLeft / 60); const seconds = timeLeft % 60; timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`; const totalSeconds = modes[currentMode].time; const percentage = ((totalSeconds - timeLeft) / totalSeconds) * 360; document.getElementById('pomodoroDial').style.background = `conic-gradient(#38bdf8 ${percentage}deg, #2d3748 ${percentage}deg)`; } function startTimer() { if (isRunning) return; isRunning = true; document.getElementById('startStopBtn').innerHTML = '<i class="fas fa-pause"></i>'; timerInterval = setInterval(() => { timeLeft--; updateTimerDisplay(); if (timeLeft <= 0) { clearInterval(timerInterval); if (currentMode === 'pomodoro') { logPomodoroSession(); } switchMode(); } }, 1000); } function stopTimer() { if (!isRunning) return; isRunning = false; document.getElementById('startStopBtn').innerHTML = '<i class="fas fa-play"></i>'; clearInterval(timerInterval); } function resetTimer() { stopTimer(); timeLeft = modes[currentMode].time; updateTimerDisplay(); } function switchMode(forceNext = false) { stopTimer(); if (currentMode === 'pomodoro') { if (!forceNext) sessionCount++; currentMode = sessionCount % 4 === 0 ? 'longBreak' : 'shortBreak'; } else { currentMode = 'pomodoro'; } timeLeft = modes[currentMode].time; document.getElementById('timer-status').textContent = modes[currentMode].status; document.getElementById('session-tracker').textContent = `${Math.ceil(sessionCount/2)} / 4 Sessions`; updateTimerDisplay(); } async function logPomodoroSession() { const duration = modes.pomodoro.time; const assigned = document.getElementById('pomodoroSubjectAssign').value; let [subjectId, lectureId] = assigned ? assigned.split('-').map(Number) : [null, null]; await apiRequest('/api/pomodoro', 'POST', { duration, subject_id: subjectId, lecture_id: lectureId }); renderDashboardMetrics(); renderSubjects(); }
    async function renderPomodoroAssignments() { const subjects = await apiRequest('/api/subjects'); const select = document.getElementById('pomodoroSubjectAssign'); select.innerHTML = '<option value="">Assign to lecture...</option>'; subjects.forEach(s => { const optgroup = document.createElement('optgroup'); optgroup.label = s.name; s.lectures.forEach(l => { optgroup.innerHTML += `<option value="${s.id}-${l.id}">${s.name} - Lecture ${l.lecture_number}</option>`; }); select.appendChild(optgroup); }); }
    async function addPlayer() { const input = document.getElementById('newPlayerNameInput'); const name = input.value.trim(); if (name) { await apiRequest('/api/basketball/players', 'POST', { name }); input.value = ''; renderPlayerStats(); } }
    function importVideo(target) { const file = target.files[0]; const videoPlayer = document.getElementById('basketball-video'); if (file) { videoPlayer.src = URL.createObjectURL(file); videoPlayer.style.display = 'block'; document.getElementById('video-placeholder').style.display = 'none'; } }
    async function saveTag() { const modal = document.getElementById('mainModal'); const data = { time: document.getElementById('basketball-video').currentTime, player_id: parseInt(modal.querySelector('#tag-player').value), category: modal.querySelector('#tag-category').value, action: modal.querySelector('#tag-action').value, stat_type: modal.querySelector('#tag-stat-type').value }; await apiRequest('/api/basketball/tags', 'POST', data); modal.style.display = 'none'; renderTimeline(); }
    function handleShotChartClick(e) { const rect = e.currentTarget.getBoundingClientRect(); tempShotData = { x: (e.clientX - rect.left) / rect.width * 100, y: (e.clientY - rect.top) / rect.height * 100 }; openModal('shot'); }
    async function logShot(made) { const { players } = await apiRequest('/api/basketball/data'); if (!players || players.length === 0) { alert("Cannot log shot, no players exist."); return; } await apiRequest('/api/basketball/shots', 'POST', { ...tempShotData, made, player_id: players[0].id }); mainModal.style.display = 'none'; renderShotChart(); }
    async function renderTimeline() { const { tags } = await apiRequest('/api/basketball/data'); const container = document.getElementById('analysis-timeline'); container.innerHTML = tags.length === 0 ? '<p class="text-gray-400">Tagged actions will appear here.</p>' : tags.map(tag => `<div class="bg-gray-700 p-2 rounded-lg text-sm"><p><strong class="text-blue-400">${formatVideoTime(tag.time)}</strong> - ${tag.player_name}</p><p class="text-gray-300">${tag.category}: ${tag.action}</p></div>`).join(''); }
    async function renderShotChart() { const { shots } = await apiRequest('/api/basketball/data'); const container = document.getElementById('bball-shot-chart'); container.innerHTML = `<div class="bg-gray-800 p-4 rounded-lg"><h3 class="text-xl font-semibold mb-4">Shot Chart</h3><div id="shot-chart-container"></div></div>`; const chartContainer = container.querySelector('#shot-chart-container'); chartContainer.innerHTML = shots.map(shot => `<div class="shot-dot" style="left: ${shot.x}%; top: ${shot.y}%; background-color: ${shot.made ? '#4ade80' : '#f87171'};"></div>`).join(''); }
    function renderLineupImpact() { document.getElementById('bball-lineups').innerHTML = '<p class="text-gray-400">Lineup analysis coming soon.</p>'; }
    function renderGameReport() { document.getElementById('bball-report').innerHTML = '<p class="text-gray-400">Game reports coming soon.</p>'; }
    function formatTime(seconds, short = false) { if (isNaN(seconds) || seconds < 0) return "0m"; const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); return short ? `${h}h ${m}m` : `${h}h ${m}m`; }
    function formatVideoTime(timeInSeconds) { const minutes = Math.floor(timeInSeconds / 60); const seconds = Math.floor(timeInSeconds % 60); return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`; }
    function getColor(colorName) { const colors = { red: '248, 113, 113', green: '74, 222, 128', blue: '96, 165, 250', indigo: '129, 140, 248', purple: '167, 139, 250', yellow: '250, 204, 21', teal: '45, 212, 191' }; return colors[colorName] || colors.blue; }
    function timeToMinutes(timeStr) { const [hours, minutes] = timeStr.split(':').map(Number); return hours * 60 + minutes; }

    // --- INITIALIZATION ---
    setupNavigation();
    loadPageData('dashboard');
    updateTimerDisplay();
});
