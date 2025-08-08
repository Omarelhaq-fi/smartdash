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
                return; 
            }
        } catch (error) {
            console.error(`API request failed: ${method} ${url}`, error);
            // Replace alert with a custom message box
            // alert(`Error: ${error.message}`);
            // throw error;
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
            e.target.style.display = 'none';
            return;
        }
        
        const targetButton = e.target.closest('button, a, .close-modal');
        if (!targetButton && !e.target.closest('.flashcard') && e.target.id !== 'shot-chart-container') return;
        
        if (targetButton && targetButton.closest('.close-modal')) {
             targetButton.closest('.modal').style.display = 'none';
             return;
        }
        
        const id = targetButton ? targetButton.id : (e.target.id || e.target.closest('.flashcard')?.id);

        const actions = {
            'addSubjectBtn': addSubject, 'addExamBtn': addExam, 'addMistakeBtn': openMistakeModal, 'saveMistakeBtn': saveMistake,
            'addCourseBtn': openCourseModal, 'saveCourseBtn': saveCourse, 'addCustomEventBtn': openCustomEventModal, 'saveCustomEventBtn': saveCustomEvent,
            'addExerciseBtn': openExerciseModal, 'saveExerciseBtn': saveExercise, 'addGymWorkoutBtn': openGymScheduleModal, 'saveGymWorkoutBtn': saveGymWorkout,
            'import-video-btn': () => document.getElementById('video-upload').click(),
            'add-tag-btn': openTaggingModal, 'saveTagBtn': saveTag, 'shot-made-btn': () => logShot(true), 'shot-missed-btn': () => logShot(false),
            'flipFlashcard': () => document.querySelector('.flashcard').classList.toggle('is-flipped'), 'prevFlashcard': () => navigateFlashcard(-1), 'nextFlashcard': () => navigateFlashcard(1),
            'addFlashcardBtn': addFlashcard, 'startStopBtn': () => isRunning ? stopTimer() : startTimer(), 'resetTimerBtn': resetTimer, 'skipBtn': () => switchMode(true),
            'addPlayerBtn': addPlayer, // Added action for the new button
        };

        if (actions[id]) actions[id]();
        else if (targetButton?.classList.contains('add-lecture')) addLecture(targetButton.dataset.subjectId);
        else if (targetButton?.closest('.open-flashcards')) {
            const subjectId = targetButton.closest('[data-subject-id]').dataset.subjectId;
            const lectureId = targetButton.closest('[data-lecture-id]').dataset.lectureId;
            openFlashcardModal(subjectId, lectureId);
        } else if (targetButton?.classList.contains('edit-exercise-btn')) {
            openExerciseModal(targetButton.dataset.exerciseId);
        } else if (e.target.id === 'shot-chart-container') {
            handleShotChartClick(e);
        } else if (targetButton?.classList.contains('add-exercise-to-workout')) {
            addExerciseToWorkout(targetButton.dataset.exerciseId, targetButton.dataset.exerciseName);
        }
    }

    function handleGlobalChange(e) {
        const target = e.target;
        if (target.closest('.lecture-table-input')) updateLecture(target);
        if (target.id === 'video-upload') importVideo(target);
    }

    // --- RENDER FUNCTIONS (Dashboard, Subjects, Courses etc. are mostly unchanged) ---
    async function renderDashboardMetrics() {
        const data = await apiRequest('/api/dashboard_metrics');
        document.getElementById('pomodoroDaily').textContent = formatTime(data.pomodoro.daily, true);
        document.getElementById('pomodoroWeekly').textContent = formatTime(data.pomodoro.weekly, true);
        document.getElementById('pomodoroMonthly').textContent = formatTime(data.pomodoro.monthly, true);
        const examContainer = document.getElementById('examCountdownContainer');
        examContainer.innerHTML = data.exams.length === 0 ? '<p class="text-gray-400">No upcoming exams.</p>' : data.exams.map(exam => `<div class="mb-2"><p><strong>${exam.name}</strong> is in <span class="text-blue-400 font-bold">${Math.max(0, Math.ceil((new Date(exam.date) - new Date()) / (1000 * 60 * 60 * 24)))} days</span></p></div>`).join('');
        const weakTopicsList = document.getElementById('weakTopicsList');
        weakTopicsList.innerHTML = data.weak_topics.length === 0 ? '<li>No mistakes logged.</li>' : data.weak_topics.map(m => `<li>${m.topic} (${m.subject_name})</li>`).join('');
        renderWeeklyChart();
    }
    
    // Unchanged functions: renderWeeklyChart, renderSubjects, addSubject, addLecture, updateLecture, renderExams, addExam, generateReverseSchedule, openMistakeModal, saveMistake, Pomodoro functions, Flashcard functions, Course functions, Schedule functions...
    function renderWeeklyChart() { const ctx = document.getElementById('weeklyStudyChart').getContext('2d'); const isDark = document.documentElement.classList.contains('dark'); const gridColor = isDark ? '#4a5568' : '#e2e8f0'; const textColor = isDark ? '#a0aec0' : '#4a5568'; const data = { labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], datasets: [{ label: 'Study Hours', data: Array(7).fill(0).map(() => Math.random() * 5), backgroundColor: '#38bdf8', borderRadius: 5 }] }; if (weeklyChart) weeklyChart.destroy(); weeklyChart = new Chart(ctx, { type: 'bar', data: data, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Hours Studied', color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } }, x: { grid: { display: false }, ticks: { color: textColor } } }, plugins: { legend: { display: false } } } }); }
    async function renderSubjects() { const subjects = await apiRequest('/api/subjects'); const container = document.getElementById('subjectsContainer'); container.innerHTML = ''; if (subjects.length === 0) { container.innerHTML = '<p class="text-gray-400">No subjects added yet. Add one above!</p>'; return; } subjects.forEach(s => { const el = document.createElement('div'); el.className = 'bg-gray-800 p-6 rounded-lg'; const lecturesHtml = s.lectures.map(l => `<tr><td class="p-2">${l.lecture_number}</td><td class="p-2"><input type="number" value="${l.uni_lecs}" class="w-16 bg-gray-700 p-1 rounded lecture-table-input" data-type="uni_lecs" data-lecture-id="${l.id}"></td><td class="p-2"><input type="number" value="${l.studied}" class="w-16 bg-gray-700 p-1 rounded lecture-table-input" data-type="studied" data-lecture-id="${l.id}"></td><td class="p-2"><label class="toggle-switch"><input type="checkbox" ${l.revised ? 'checked' : ''} class="lecture-table-input" data-type="revised" data-lecture-id="${l.id}"><span class="slider"></span></label></td><td class="p-2"><button class="text-blue-400 open-flashcards" data-subject-id="${s.id}" data-lecture-id="${l.lecture_number}"><i class="fas fa-clone"></i></button></td></tr>`).join(''); el.innerHTML = `<h2 class="text-xl font-semibold mb-4">${s.name}</h2><div class="overflow-x-auto"><table class="w-full text-left"><thead><tr><th>Lec#</th><th>Univ.</th><th>Studied</th><th>Status</th><th>Actions</th></tr></thead><tbody>${lecturesHtml}</tbody></table></div><button class="mt-4 text-sm text-blue-400 add-lecture" data-subject-id="${s.id}">+ Add Lecture</button>`; container.appendChild(el); }); }
    async function addSubject() { const input = document.getElementById('newSubjectInput'); const name = input.value.trim(); if (name) { await apiRequest('/api/subjects', 'POST', { name }); input.value = ''; renderSubjects(); renderPomodoroAssignments(); } }
    async function addLecture(subjectId) { await apiRequest(`/api/subjects/${subjectId}/lectures`, 'POST'); renderSubjects(); renderPomodoroAssignments(); }
    async function updateLecture(target) { const lectureId = target.dataset.lectureId; const row = target.closest('tr'); const data = { uni_lecs: parseInt(row.querySelector('[data-type="uni_lecs"]').value), studied: parseInt(row.querySelector('[data-type="studied"]').value), revised: row.querySelector('[data-type="revised"]').checked }; await apiRequest(`/api/lectures/${lectureId}`, 'PUT', data); }
    async function renderExams() { generateReverseSchedule(); }
    async function addExam() { const nameInput = document.getElementById('examNameInput'); const dateInput = document.getElementById('examDateInput'); if (nameInput.value && dateInput.value) { await apiRequest('/api/exams', 'POST', { name: nameInput.value, date: dateInput.value }); nameInput.value = ''; dateInput.value = ''; renderDashboardMetrics(); generateReverseSchedule(); } }
    async function generateReverseSchedule() { const container = document.getElementById('reverseScheduleContainer'); const exams = await apiRequest('/api/exams'); const subjects = await apiRequest('/api/subjects'); if (exams.length === 0) { container.innerHTML = '<p class="text-gray-400">Add an exam to generate a schedule.</p>'; return; } const upcomingExam = exams[0]; const daysUntilExam = Math.ceil((new Date(upcomingExam.date) - new Date()) / (1000 * 60 * 60 * 24)); const totalLecturesToStudy = subjects.reduce((sum, s) => sum + s.lectures.reduce((lecSum, l) => lecSum + (l.uni_lecs - l.studied), 0), 0); const lecturesPerDay = totalLecturesToStudy > 0 && daysUntilExam > 3 ? (totalLecturesToStudy / (daysUntilExam - 3)).toFixed(1) : 0; container.innerHTML = `<h3 class="font-semibold text-lg">${upcomingExam.name} Plan</h3><p>Study <strong class="text-blue-400">${lecturesPerDay} lectures per day</strong>.</p>`; }
    async function openMistakeModal() { const subjects = await apiRequest('/api/subjects'); let selectHTML = '<option value="">Select Subject</option>'; subjects.forEach(s => selectHTML += `<option value="${s.id}">${s.name}</option>`); document.getElementById('mistakeModal').innerHTML = `<div class="modal-content"><span class="close-modal absolute top-4 right-6 text-2xl font-bold cursor-pointer">&times;</span><h2 class="text-xl font-bold mb-4">Log Mistake</h2><div class="space-y-4"><input type="text" id="mistakeTopicInput" placeholder="Topic" class="bg-gray-700 w-full p-2 rounded"><textarea id="mistakeDescriptionInput" placeholder="Description" class="bg-gray-700 w-full p-2 rounded h-24"></textarea><select id="mistakeSubjectSelect" class="bg-gray-700 w-full p-2 rounded">${selectHTML}</select><button id="saveMistakeBtn" class="w-full bg-blue-600 p-2 rounded">Save</button></div></div>`; document.getElementById('mistakeModal').style.display = 'flex'; }
    async function saveMistake() { const topic = document.getElementById('mistakeTopicInput').value.trim(); const description = document.getElementById('mistakeDescriptionInput').value.trim(); const subjectId = parseInt(document.getElementById('mistakeSubjectSelect').value); if (topic && description && subjectId) { await apiRequest('/api/mistakes', 'POST', { topic, description, subject_id: subjectId }); document.getElementById('mistakeModal').style.display = 'none'; renderDashboardMetrics(); } }
    let timerInterval, isRunning = false, timeLeft = 1500, currentMode = 'pomodoro', sessionCount = 1; const modes = { pomodoro: { time: 1500, status: 'Stay Focused' }, shortBreak: { time: 300, status: 'Short Break' }, longBreak: { time: 900, status: 'Long Break' } }; function updateTimerDisplay() { const timerDisplay = document.getElementById('timer'); if (!timerDisplay) return; const minutes = Math.floor(timeLeft / 60); const seconds = timeLeft % 60; timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`; const totalSeconds = modes[currentMode].time; const percentage = ((totalSeconds - timeLeft) / totalSeconds) * 360; document.getElementById('pomodoroDial').style.background = `conic-gradient(#38bdf8 ${percentage}deg, #2d3748 ${percentage}deg)`; } function startTimer() { if (isRunning) return; isRunning = true; document.getElementById('startStopBtn').innerHTML = '<i class="fas fa-pause"></i>'; timerInterval = setInterval(() => { timeLeft--; updateTimerDisplay(); if (timeLeft <= 0) { clearInterval(timerInterval); if (currentMode === 'pomodoro') { logPomodoroSession(); } switchMode(); } }, 1000); } function stopTimer() { if (!isRunning) return; isRunning = false; document.getElementById('startStopBtn').innerHTML = '<i class="fas fa-play"></i>'; clearInterval(timerInterval); } function resetTimer() { stopTimer(); timeLeft = modes[currentMode].time; updateTimerDisplay(); } function switchMode(forceNext = false) { stopTimer(); if (currentMode === 'pomodoro') { if (!forceNext) sessionCount++; currentMode = sessionCount % 4 === 0 ? 'longBreak' : 'shortBreak'; } else { currentMode = 'pomodoro'; } timeLeft = modes[currentMode].time; document.getElementById('timer-status').textContent = modes[currentMode].status; document.getElementById('session-tracker').textContent = `${Math.ceil(sessionCount/2)} / 4 Sessions`; updateTimerDisplay(); } async function logPomodoroSession() { const duration = modes.pomodoro.time; const assigned = document.getElementById('pomodoroSubjectAssign').value; let [subjectId, lectureId] = assigned ? assigned.split('-').map(Number) : [null, null]; await apiRequest('/api/pomodoro', 'POST', { duration, subject_id: subjectId, lecture_id: lectureId }); renderDashboardMetrics(); }
    async function renderPomodoroAssignments() { const subjects = await apiRequest('/api/subjects'); const select = document.getElementById('pomodoroSubjectAssign'); select.innerHTML = '<option value="">Assign to lecture...</option>'; subjects.forEach(s => { const optgroup = document.createElement('optgroup'); optgroup.label = s.name; s.lectures.forEach(l => { optgroup.innerHTML += `<option value="${s.id}-${l.lecture_number}">Lecture ${l.lecture_number}</option>`; }); select.appendChild(optgroup); }); }
    async function openFlashcardModal(subjectId, lectureId) { const subject = (await apiRequest('/api/subjects')).find(s => s.id == subjectId); const cards = await apiRequest(`/api/subjects/${subjectId}/lectures/${lectureId}/flashcards`); currentFlashcardState = { subjectId, lectureId, cards, currentIndex: 0 }; document.getElementById('flashcardModal').innerHTML = `<div class="modal-content"><span class="close-modal absolute top-4 right-6 text-2xl font-bold cursor-pointer">&times;</span><h2 class="text-xl font-bold mb-4">Flashcards for ${subject.name} - Lec ${lectureId}</h2><div class="mb-4"><div class="flashcard" id="flipFlashcard"><div class="flashcard-inner"><div class="flashcard-front"><p id="flashcard-front-content"></p></div><div class="flashcard-back"><p id="flashcard-back-content"></p></div></div></div></div><div class="flex justify-between items-center mb-4"><button id="prevFlashcard" class="bg-gray-600 p-2 rounded"><i class="fas fa-arrow-left"></i></button><span id="flashcardCounter"></span><button id="nextFlashcard" class="bg-gray-600 p-2 rounded"><i class="fas fa-arrow-right"></i></button></div><div class="flex gap-4"><input type="text" id="newFlashcardFront" placeholder="Front" class="bg-gray-700 w-1/2 p-2 rounded"><input type="text" id="newFlashcardBack" placeholder="Back" class="bg-gray-700 w-1/2 p-2 rounded"></div><button id="addFlashcardBtn" class="w-full mt-4 bg-green-600 p-2 rounded">Add Card</button></div>`; renderFlashcard(); document.getElementById('flashcardModal').style.display = 'flex'; }
    function renderFlashcard() { const { cards, currentIndex } = currentFlashcardState; const modal = document.getElementById('flashcardModal'); modal.querySelector('.flashcard').classList.remove('is-flipped'); if (cards.length === 0) { modal.querySelector('#flashcard-front-content').textContent = 'No cards yet.'; modal.querySelector('#flashcard-back-content').textContent = 'Add one!'; modal.querySelector('#flashcardCounter').textContent = '0 / 0'; } else { const card = cards[currentIndex]; modal.querySelector('#flashcard-front-content').textContent = card.front; modal.querySelector('#flashcard-back-content').textContent = card.back; modal.querySelector('#flashcardCounter').textContent = `${currentIndex + 1} / ${cards.length}`; } }
    function navigateFlashcard(direction) { const { cards } = currentFlashcardState; if (cards.length > 0) { currentFlashcardState.currentIndex = (currentFlashcardState.currentIndex + direction + cards.length) % cards.length; renderFlashcard(); } }
    async function addFlashcard() { const modal = document.getElementById('flashcardModal'); const front = modal.querySelector('#newFlashcardFront').value.trim(); const back = modal.querySelector('#newFlashcardBack').value.trim(); const { subjectId, lectureId } = currentFlashcardState; if (front && back) { await apiRequest('/api/flashcards', 'POST', { subject_id: subjectId, lecture_id: lectureId, front, back }); openFlashcardModal(subjectId, lectureId); } }
    async function renderCourses() { const courses = await apiRequest('/api/courses'); const container = document.getElementById('courseLibraryContainer'); container.innerHTML = ''; if (courses.length === 0) { container.innerHTML = '<p class="text-gray-400 md:col-span-2">No courses added.</p>'; return; } courses.forEach(c => { const progress = c.total_units > 0 ? (c.completed_units / c.total_units) * 100 : 0; container.innerHTML += `<div class="bg-gray-700 p-4 rounded-lg"><h3 class="font-bold">${c.title}</h3><p class="text-sm text-gray-400">${c.platform} - ${c.category}</p><div class="mt-3"><div class="flex justify-between text-sm mb-1"><span>Progress</span><span>${Math.round(progress)}%</span></div><div class="w-full bg-gray-600 rounded-full h-2.5"><div class="bg-blue-500 h-2.5 rounded-full" style="width: ${progress}%"></div></div><p class="text-xs text-gray-500 mt-1">${c.completed_units}/${c.total_units} units</p></div></div>`; }); }
    function openCourseModal() { document.getElementById('courseModal').innerHTML = `<div class="modal-content"><span class="close-modal absolute top-4 right-6 text-2xl font-bold cursor-pointer">&times;</span><h2 class="text-xl font-bold mb-4">Add Course</h2><div class="space-y-4"><input type="text" id="courseTitleInput" placeholder="Title" class="bg-gray-700 w-full p-2 rounded"><div class="grid grid-cols-2 gap-4"><input type="text" id="coursePlatformInput" placeholder="Platform" class="bg-gray-700 w-full p-2 rounded"><input type="text" id="courseCategoryInput" placeholder="Category" class="bg-gray-700 w-full p-2 rounded"></div><div class="grid grid-cols-2 gap-4"><input type="number" id="courseTotalUnitsInput" placeholder="Total Units" class="bg-gray-700 w-full p-2 rounded"><input type="number" id="courseCompletedUnitsInput" placeholder="Completed Units" class="bg-gray-700 w-full p-2 rounded"></div><div><label class="text-sm">Target Date</label><input type="date" id="courseTargetDateInput" class="bg-gray-700 w-full p-2 rounded"></div><input type="number" id="courseSessionsWeekInput" placeholder="Target Sessions/Week" class="bg-gray-700 w-full p-2 rounded"><button id="saveCourseBtn" class="w-full bg-blue-600 p-2 rounded">Save</button></div></div>`; document.getElementById('courseModal').style.display = 'flex'; }
    async function saveCourse() { const modal = document.getElementById('courseModal'); const data = { title: modal.querySelector('#courseTitleInput').value, platform: modal.querySelector('#coursePlatformInput').value, category: modal.querySelector('#courseCategoryInput').value, total_units: parseInt(modal.querySelector('#courseTotalUnitsInput').value) || 0, completed_units: parseInt(modal.querySelector('#courseCompletedUnitsInput').value) || 0, target_date: modal.querySelector('#courseTargetDateInput').value, sessions_per_week: parseInt(modal.querySelector('#courseSessionsWeekInput').value) || 1 }; await apiRequest('/api/courses', 'POST', data); modal.style.display = 'none'; renderCourses(); }
    async function renderSchedule() {
        const events = await apiRequest('/api/schedule');
        const container = document.getElementById('timeline-container');
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < 24; i++) {
            container.innerHTML += `<div class="timeline-hour"><span class="timeline-hour-label">${i.toString().padStart(2, '0')}:00</span></div>`;
        }
        events.forEach(e => {
            const startMinutes = timeToMinutes(e.start_time);
            const endMinutes = timeToMinutes(e.end_time);
            const duration = endMinutes - startMinutes;
            const color = e.color || 'purple'; // Use color from event, default to purple
            const eventHtml = `<div class="timeline-event" style="top:${startMinutes}px; height:${duration}px; background-color:rgba(${getColor(color)}, 0.5); border-color:rgb(${getColor(color)});"><p class="font-bold">${e.title}</p>${e.description ? `<p class="text-xs text-gray-200">${e.description}</p>` : ''}</div>`;
            container.innerHTML += eventHtml;
        });
    }
    function openCustomEventModal() { document.getElementById('customEventModal').innerHTML = `<div class="modal-content"><span class="close-modal absolute top-4 right-6 text-2xl font-bold cursor-pointer">&times;</span><h2 class="text-xl font-bold mb-4">Add Custom Event</h2><div class="space-y-4"><input type="text" id="customEventTitle" placeholder="Title" class="bg-gray-700 w-full p-2 rounded"><div class="grid grid-cols-2 gap-4"><div><label class="text-sm">Start</label><input type="time" id="customEventStart" class="bg-gray-700 w-full p-2 rounded"></div><div><label class="text-sm">End</label><input type="time" id="customEventEnd" class="bg-gray-700 w-full p-2 rounded"></div></div><div><label class="text-sm">Color</label><select id="customEventColor" class="bg-gray-700 w-full p-2 rounded"><option value="purple">Purple</option><option value="yellow">Yellow</option><option value="teal">Teal</option></select></div><button id="saveCustomEventBtn" class="w-full bg-blue-600 p-2 rounded">Save</button></div></div>`; document.getElementById('customEventModal').style.display = 'flex'; }
    async function saveCustomEvent() { const modal = document.getElementById('customEventModal'); const data = { title: modal.querySelector('#customEventTitle').value, start_time: modal.querySelector('#customEventStart').value, end_time: modal.querySelector('#customEventEnd').value, color: modal.querySelector('#customEventColor').value }; if (data.title && data.start_time && data.end_time) { await apiRequest('/api/schedule', 'POST', data); modal.style.display = 'none'; renderSchedule(); } }

    // --- GYM FUNCTIONS ---
    function renderTodaysWorkout() { document.getElementById('gym-today').innerHTML = '<p class="text-gray-400">Today\'s workout plan coming soon...</p>'; }
    async function renderGymPlanner() {
        const schedules = await apiRequest('/api/gym/schedule');
        const container = document.getElementById('gym-planner');
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        container.innerHTML = `
            <h2 class="text-2xl font-semibold mb-4">Weekly Planner</h2>
            <button id="addGymWorkoutBtn" class="mb-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Add New Workout</button>
            <div id="weeklyGymSchedule" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"></div>
        `;
        const scheduleContainer = document.getElementById('weeklyGymSchedule');
        const schedulesByDay = schedules.reduce((acc, curr) => {
            if (!acc[curr.day_of_week]) acc[curr.day_of_week] = [];
            acc[curr.day_of_week].push(curr);
            return acc;
        }, {});

        for (let i = 0; i < 7; i++) {
            const dayName = days[i];
            const workouts = schedulesByDay[i] || [];
            let workoutsHtml = workouts.length === 0
                ? `<p class="text-gray-400 text-sm">No workout scheduled.</p>`
                : workouts.map(w => `
                    <div class="bg-gray-700 p-3 rounded-lg mt-2">
                        <h4 class="font-bold">${w.workout_name}</h4>
                        <p class="text-xs text-gray-400">${w.start_time} - ${w.end_time}</p>
                        <ul class="list-disc list-inside text-sm text-gray-300 mt-2">
                            ${w.exercises.map(ex => `<li>${ex.name} (${ex.sets}x${ex.reps})</li>`).join('')}
                        </ul>
                    </div>
                `).join('');
            
            scheduleContainer.innerHTML += `
                <div class="bg-gray-800 p-4 rounded-lg">
                    <h3 class="font-bold text-lg mb-2">${dayName}</h3>
                    <hr class="border-gray-700 mb-2">
                    ${workoutsHtml}
                </div>
            `;
        }
    }
    async function openGymScheduleModal() {
        const exercises = await apiRequest('/api/gym/exercises');
        const modal = document.getElementById('gymScheduleModal');
        let exerciseOptions = exercises.map(ex => `<option value="${ex.id}" data-name="${ex.name}">${ex.name}</option>`).join('');
        
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal absolute top-4 right-6 text-2xl font-bold cursor-pointer">&times;</span>
                <h2 class="text-xl font-bold mb-4">Add New Workout</h2>
                <div class="space-y-4">
                    <input type="text" id="workoutNameInput" placeholder="Workout Name (e.g., Push Day)" class="bg-gray-700 w-full p-2 rounded">
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="text-sm">Day</label><select id="workoutDayInput" class="bg-gray-700 w-full p-2 rounded">
                            <option value="0">Monday</option><option value="1">Tuesday</option><option value="2">Wednesday</option>
                            <option value="3">Thursday</option><option value="4">Friday</option><option value="5">Saturday</option>
                            <option value="6">Sunday</option>
                        </select></div>
                        <div><label class="text-sm">Start Time</label><input type="time" id="workoutStartTimeInput" class="bg-gray-700 w-full p-2 rounded"></div>
                        <div><label class="text-sm">End Time</label><input type="time" id="workoutEndTimeInput" class="bg-gray-700 w-full p-2 rounded"></div>
                    </div>
                    <div class="bg-gray-700 p-4 rounded-lg">
                        <h3 class="font-bold mb-2">Exercises</h3>
                        <div id="selectedExercisesContainer" class="space-y-2 mb-4"></div>
                        <div class="flex items-center gap-2">
                            <select id="exerciseToAdd" class="bg-gray-800 w-full p-2 rounded">${exerciseOptions}</select>
                            <button id="addExerciseToWorkoutBtn" class="bg-green-600 p-2 rounded text-white">Add</button>
                        </div>
                    </div>
                    <button id="saveGymWorkoutBtn" class="w-full bg-blue-600 p-2 rounded">Save Workout</button>
                </div>
            </div>
        `;
        document.getElementById('addExerciseToWorkoutBtn').addEventListener('click', () => {
            const select = document.getElementById('exerciseToAdd');
            const exerciseId = select.value;
            const exerciseName = select.options[select.selectedIndex].textContent;
            addExerciseToWorkout(exerciseId, exerciseName);
        });
        modal.style.display = 'flex';
    }
    function addExerciseToWorkout(exerciseId, exerciseName) {
        const container = document.getElementById('selectedExercisesContainer');
        const newExercise = document.createElement('div');
        newExercise.className = 'bg-gray-600 p-2 rounded-lg flex items-center justify-between';
        newExercise.innerHTML = `
            <input type="hidden" name="exerciseId" value="${exerciseId}">
            <span>${exerciseName}</span>
            <div class="flex items-center gap-2">
                <input type="number" name="sets" placeholder="Sets" class="w-16 bg-gray-700 p-1 rounded text-right" value="3">
                <input type="text" name="reps" placeholder="Reps" class="w-24 bg-gray-700 p-1 rounded text-right" value="8-12">
            </div>
        `;
        container.appendChild(newExercise);
    }
    async function saveGymWorkout() {
        const modal = document.getElementById('gymScheduleModal');
        const exercises = Array.from(modal.querySelectorAll('#selectedExercisesContainer > div')).map(el => ({
            id: el.querySelector('input[name="exerciseId"]').value,
            name: el.querySelector('span').textContent,
            sets: el.querySelector('input[name="sets"]').value,
            reps: el.querySelector('input[name="reps"]').value,
        }));
        
        const data = {
            workout_name: modal.querySelector('#workoutNameInput').value,
            day_of_week: parseInt(modal.querySelector('#workoutDayInput').value),
            start_time: modal.querySelector('#workoutStartTimeInput').value,
            end_time: modal.querySelector('#workoutEndTimeInput').value,
            exercises
        };
        
        if (data.workout_name && data.start_time && data.end_time && data.exercises.length > 0) {
            await apiRequest('/api/gym/schedule', 'POST', data);
            modal.style.display = 'none';
            renderGymPlanner();
        } else {
            // Replace alert with a custom message box
            // alert('Please fill in all fields and add at least one exercise.');
        }
    }
    async function renderExerciseLibrary() {
        const exercises = await apiRequest('/api/gym/exercises');
        const container = document.getElementById('gym-exercises');
        container.innerHTML = `<h2 class="text-2xl font-semibold mb-4">Exercise Library</h2><button id="addExerciseBtn" class="mb-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Add Exercise</button><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>`;
        const libraryContainer = container.querySelector('div.grid');
        libraryContainer.innerHTML = '';
        exercises.forEach(ex => {
            libraryContainer.innerHTML += `<div class="bg-gray-800 p-4 rounded-lg flex flex-col justify-between"><div><h3 class="font-bold text-lg">${ex.name}</h3><p class="text-sm text-blue-400">${ex.group}</p><div class="mt-2 space-x-2">${(ex.tags || []).map(tag => `<span class="bg-gray-700 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded">${tag}</span>`).join('')}</div><p class="text-sm text-gray-400 mt-2">${ex.cues}</p></div><div class="mt-4"><button class="edit-exercise-btn text-sm text-yellow-400 hover:underline" data-exercise-id="${ex.id}">Edit</button></div></div>`;
        });
    }
    async function renderPrLog() {
        const prs = await apiRequest('/api/gym/prs');
        const container = document.getElementById('gym-prs');
        container.innerHTML = `<h2 class="text-2xl font-semibold mb-4">Personal Records</h2><div class="space-y-4"></div>`;
        const prContainer = container.querySelector('div.space-y-4');
        if (prs.length === 0) { prContainer.innerHTML = '<p class="text-gray-400">No PRs logged yet!</p>'; return; }
        prContainer.innerHTML = '';
        prs.forEach(pr => {
            prContainer.innerHTML += `<div class="bg-gray-800 p-4 rounded-lg flex items-center justify-between"><div><p class="font-bold text-xl">${pr.exercise_name}</p><p class="text-gray-400 text-sm">${new Date(pr.date).toLocaleDateString()}</p></div><div class="text-right"><p class="text-2xl font-bold text-blue-400">${pr.weight}kg x ${pr.reps}</p><p class="text-sm text-gray-500">Est. 1RM: ${Math.round(pr.weight * (1 + pr.reps / 30))}kg</p></div><div class="text-yellow-400 text-3xl"><i class="fas fa-trophy"></i></div></div>`;
        });
    }
    function openExerciseModal(exerciseId = null) {
        const isEditing = exerciseId !== null;
        document.getElementById('exerciseModal').innerHTML = `<div class="modal-content"><span class="close-modal absolute top-4 right-6 text-2xl font-bold cursor-pointer">&times;</span><h2 class="text-xl font-bold mb-4">${isEditing ? 'Edit' : 'Add'} Exercise</h2><div class="space-y-4"><input type="hidden" id="exerciseIdInput" value="${exerciseId || ''}"><input type="text" id="exerciseNameInput" placeholder="Name" class="bg-gray-700 w-full p-2 rounded"><select id="exerciseGroupInput" class="bg-gray-700 w-full p-2 rounded">${['Chest','Back','Shoulders','Biceps','Triceps','Legs','Abs','Other'].map(g => `<option>${g}</option>`).join('')}</select><input type="text" id="exerciseCuesInput" placeholder="Cues" class="bg-gray-700 w-full p-2 rounded"><input type="text" id="exerciseTagsInput" placeholder="Tags (comma-separated)" class="bg-gray-700 w-full p-2 rounded"><button id="saveExerciseBtn" class="w-full bg-blue-600 p-2 rounded">Save</button></div></div>`;
        document.getElementById('exerciseModal').style.display = 'flex';
    }
    async function saveExercise() {
        const modal = document.getElementById('exerciseModal');
        const data = {
            name: modal.querySelector('#exerciseNameInput').value,
            group: modal.querySelector('#exerciseGroupInput').value,
            cues: modal.querySelector('#exerciseCuesInput').value,
            tags: modal.querySelector('#exerciseTagsInput').value.split(',').map(t => t.trim()).filter(Boolean)
        };
        await apiRequest('/api/gym/exercises', 'POST', data);
        modal.style.display = 'none';
        renderExerciseLibrary();
    }

    // --- BASKETBALL FUNCTIONS ---
    async function addPlayer() {
        const input = document.getElementById('newPlayerNameInput');
        const name = input.value.trim();
        if (name) {
            await apiRequest('/api/basketball/players', 'POST', { name });
            input.value = '';
            renderPlayerStats(); // Re-render the stats table to show the new player
        }
    }
    function importVideo(target) { const file = target.files[0]; const videoPlayer = document.getElementById('basketball-video'); if (file) { videoPlayer.src = URL.createObjectURL(file); videoPlayer.style.display = 'block'; document.getElementById('video-placeholder').style.display = 'none'; } }
    async function openTaggingModal() {
        const videoPlayer = document.getElementById('basketball-video');
        if (!videoPlayer.src) { alert("Import a video first."); return; }
        const { players } = await apiRequest('/api/basketball/data');
        if (!players || players.length === 0) {
            alert("No players found. Please add a player in the 'Stats' tab first.");
            return;
        }
        document.getElementById('taggingModal').innerHTML = `<div class="modal-content"><span class="close-modal absolute top-4 right-6 text-2xl font-bold cursor-pointer">&times;</span><h2 class="text-xl font-bold mb-4">Tag Action</h2><div class="space-y-4"><div><label>Player</label><select id="tag-player" class="bg-gray-700 w-full p-2 rounded">${players.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select></div><div><label>Category</label><select id="tag-category" class="bg-gray-700 w-full p-2 rounded">${['Offense','Defense','Transition'].map(c => `<option>${c}</option>`).join('')}</select></div><div><label>Action</label><input type="text" id="tag-action" placeholder="e.g., Pick & Roll" class="bg-gray-700 w-full p-2 rounded"></div><div><label>Stat Type</label><select id="tag-stat-type" class="bg-gray-700 w-full p-2 rounded">${Object.entries({'none':'None','fga_made':'Shot Made','fga_missed':'Shot Missed','ast':'Assist'}).map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}</select></div><button id="saveTagBtn" class="w-full bg-blue-600 p-2 rounded">Save</button></div></div>`;
        document.getElementById('taggingModal').style.display = 'flex';
    }
    async function saveTag() {
        const modal = document.getElementById('taggingModal');
        const data = {
            time: document.getElementById('basketball-video').currentTime,
            player_id: parseInt(modal.querySelector('#tag-player').value),
            category: modal.querySelector('#tag-category').value,
            action: modal.querySelector('#tag-action').value,
            stat_type: modal.querySelector('#tag-stat-type').value
        };
        await apiRequest('/api/basketball/tags', 'POST', data);
        modal.style.display = 'none';
        renderTimeline();
    }
    function handleShotChartClick(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        tempShotData = { x: (e.clientX - rect.left) / rect.width * 100, y: (e.clientY - rect.top) / rect.height * 100 };
        document.getElementById('shotModal').innerHTML = `<div class="modal-content max-w-xs"><h2 class="text-xl font-bold mb-4 text-center">Shot Result</h2><div class="flex justify-around"><button id="shot-made-btn" class="bg-green-600 p-3 px-6 rounded">Make</button><button id="shot-missed-btn" class="bg-red-600 p-3 px-6 rounded">Miss</button></div></div>`;
        document.getElementById('shotModal').style.display = 'flex';
    }
    async function logShot(made) {
        const { players } = await apiRequest('/api/basketball/data');
        if (!players || players.length === 0) {
            alert("Cannot log shot, no players exist.");
            return;
        }
        await apiRequest('/api/basketball/shots', 'POST', { ...tempShotData, made, player_id: players[0].id });
        document.getElementById('shotModal').style.display = 'none';
        renderShotChart();
    }
    async function renderTimeline() {
        const { tags } = await apiRequest('/api/basketball/data');
        const container = document.getElementById('analysis-timeline');
        container.innerHTML = tags.length === 0 ? '<p class="text-gray-400">Tagged actions will appear here.</p>' : tags.map(tag => `<div class="bg-gray-700 p-2 rounded-lg text-sm"><p><strong class="text-blue-400">${formatVideoTime(tag.time)}</strong> - ${tag.player_name}</p><p class="text-gray-300">${tag.category}: ${tag.action}</p></div>`).join('');
    }
    async function renderShotChart() {
        const { shots } = await apiRequest('/api/basketball/data');
        const container = document.getElementById('bball-shot-chart');
        container.innerHTML = `<div class="bg-gray-800 p-4 rounded-lg"><h3 class="text-xl font-semibold mb-4">Shot Chart</h3><div id="shot-chart-container"></div></div>`;
        const chartContainer = container.querySelector('#shot-chart-container');
        chartContainer.innerHTML = shots.map(shot => `<div class="shot-dot" style="left: ${shot.x}%; top: ${shot.y}%; background-color: ${shot.made ? '#4ade80' : '#f87171'};"></div>`).join('');
    }
    async function renderPlayerStats() {
        const { stats } = await apiRequest('/api/basketball/data');
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
    function renderLineupImpact() { document.getElementById('bball-lineups').innerHTML = '<p class="text-gray-400">Lineup analysis coming soon.</p>'; }
    function renderGameReport() { document.getElementById('bball-report').innerHTML = '<p class="text-gray-400">Game reports coming soon.</p>'; }

    // --- UTILITY FUNCTIONS ---
    function formatTime(seconds, short = false) { if (isNaN(seconds) || seconds < 0) return "0m"; const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); return short ? `${h}h ${m}m` : `${h}h ${m}m`; }
    function formatVideoTime(timeInSeconds) { const minutes = Math.floor(timeInSeconds / 60); const seconds = Math.floor(timeInSeconds % 60); return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`; }
    function getColor(colorName) { const colors = { red: '248, 113, 113', green: '74, 222, 128', blue: '96, 165, 250', indigo: '129, 140, 248', purple: '167, 139, 250', yellow: '250, 204, 21', teal: '45, 212, 191' }; return colors[colorName] || colors.blue; }
    function timeToMinutes(timeStr) { const [hours, minutes] = timeStr.split(':').map(Number); return hours * 60 + minutes; }

    // --- INITIALIZATION ---
    setupNavigation();
    loadPageData('dashboard'); // Load initial page
    updateTimerDisplay();
});
